import {
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { ok, error } from '@ucanto/core'
import { EntryNotFound, EntryExists } from '@storacha/upload-api/blob'
import { base58btc } from 'multiformats/bases/base58'
import * as Link from 'multiformats/link'
import * as Digest from 'multiformats/hashes/digest'
import { getDynamoClient } from '../../lib/aws/dynamo.js'
import { METRICS_NAMES, SPACE_METRICS_NAMES } from '../constants.js'

/** @import { BlobAPI } from '@storacha/upload-api/types' */

/**
 * @param {string} region
 * @param {string} tableName
 * @param {{
 *   space: import('../types.js').SpaceMetricsStore
 *   admin: import('../types.js').MetricsStore
 * }} metrics
 * @param {object} [options]
 * @param {string} [options.endpoint]
 * @returns {BlobAPI.Registry}
 */
export const createBlobRegistry = (region, tableName, metrics, options = {}) => {
  const dynamoDb = getDynamoClient({ region, endpoint: options.endpoint })
  return useBlobRegistry(dynamoDb, tableName, metrics)
}

/**
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamoDb
 * @param {string} tableName
 * @param {{
 *   space: import('../types.js').SpaceMetricsStore
 *   admin: import('../types.js').MetricsStore
 * }} metrics
 * @returns {BlobAPI.Registry}
 */
export const useBlobRegistry = (dynamoDb, tableName, metrics) => ({
  /** @type {BlobAPI.Registry['find']} */
  async find (space, digest) {
    const key = getKey(space, digest)
    const cmd = new GetItemCommand({
      TableName: tableName,
      Key: key,
    })

    const response = await dynamoDb.send(cmd)
    if (!response.Item) {
      return error(new EntryNotFound())
    }

    const raw = unmarshall(response.Item)
    return ok({
      blob: {
        digest: Digest.decode(base58btc.decode(raw.digest)),
        size: raw.size
      },
      cause: Link.parse(raw.cause).toV1(),
      insertedAt: new Date(raw.insertedAt)
    })
  },

  /** @type {BlobAPI.Registry['register']} */
  register: async ({ space, blob, cause }) => {
    const item = {
      space,
      digest: base58btc.encode(blob.digest.bytes),
      size: blob.size,
      cause: cause.toString(),
      insertedAt: new Date().toISOString(),
    }
    const cmd = new PutItemCommand({
      TableName: tableName,
      Item: marshall(item, { removeUndefinedValues: true }),
      ConditionExpression: 'attribute_not_exists(#S) AND attribute_not_exists(#D)',
      ExpressionAttributeNames: { '#S': 'space', '#D': 'digest' }
    })

    try {
      await dynamoDb.send(cmd)
      await Promise.all([
        metrics.space.incrementTotals({
          [SPACE_METRICS_NAMES.BLOB_ADD_TOTAL]: [{ space, value: 1 }],
          [SPACE_METRICS_NAMES.BLOB_ADD_SIZE_TOTAL]: [{ space, value: blob.size }]
        }),
        metrics.admin.incrementTotals({
          [METRICS_NAMES.BLOB_ADD_TOTAL]: 1,
          [METRICS_NAMES.BLOB_ADD_SIZE_TOTAL]: blob.size
        })
      ])
    } catch (/** @type {any} */ err) {
      if (err.name === 'ConditionalCheckFailedException') {
        return error(new EntryExists())
      }
      return error(err)
    }
    return ok({})
  },

  /** @type {BlobAPI.Registry['deregister']} */
  async deregister(space, digest) {
    const key = getKey(space, digest)
    const cmd = new DeleteItemCommand({
      TableName: tableName,
      Key: key,
      ConditionExpression: 'attribute_exists(#S) AND attribute_exists(#D)',
      ExpressionAttributeNames: { '#S': 'space', '#D': 'digest' },
      ReturnValues: 'ALL_OLD'
    })

    try {
      const res = await dynamoDb.send(cmd)

      if (!res.Attributes) {
        throw new Error('missing return values')
      }
      const raw = unmarshall(res.Attributes)
      const size = Number(raw.size)

      await Promise.all([
        metrics.space.incrementTotals({
          [SPACE_METRICS_NAMES.BLOB_REMOVE_TOTAL]: [{ space, value: 1 }],
          [SPACE_METRICS_NAMES.BLOB_REMOVE_SIZE_TOTAL]: [{ space, value: size }]
        }),
        metrics.admin.incrementTotals({
          [METRICS_NAMES.BLOB_REMOVE_TOTAL]: 1,
          [METRICS_NAMES.BLOB_REMOVE_SIZE_TOTAL]: size
        })
      ])
      return ok({})
    } catch (/** @type {any} */ err) {
      if (err.name === 'ConditionalCheckFailedException') {
        return error(new EntryNotFound())
      }
      return error(err)
    }
  },

  /** @type {BlobAPI.Registry['entries']} */
  entries: async (space, options = {}) => {
    const exclusiveStartKey = options.cursor
      ? marshall({ space, digest: options.cursor })
      : undefined

    const cmd = new QueryCommand({
      TableName: tableName,
      Limit: options.size || 20,
      KeyConditions: {
        space: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [{ S: space }],
        },
      },
      ExclusiveStartKey: exclusiveStartKey,
      AttributesToGet: ['digest', 'size', 'cause', 'insertedAt'],
    })
    const response = await dynamoDb.send(cmd)

    const results =
      response.Items?.map((i) => toEntry(unmarshall(i))) ?? []
    const firstDigest = results[0] ? base58btc.encode(results[0].blob.digest.bytes) : undefined
    // Get cursor of the item where list operation stopped (inclusive).
    // This value can be used to start a new operation to continue listing.
    const lastKey =
      response.LastEvaluatedKey && unmarshall(response.LastEvaluatedKey)
    const lastDigest = lastKey ? lastKey.digest : undefined

    const before = firstDigest
    const after = lastDigest

    return {
      ok: {
        size: results.length,
        before,
        after,
        cursor: after,
        results,
      }
    }
  },
})

/**
 * Upgrade from the db representation
 *
 * @param {Record<string, any>} item
 * @returns {BlobAPI.Entry}
 */
export const toEntry = ({ digest, size, cause, insertedAt }) => ({
  blob: { digest: Digest.decode(base58btc.decode(digest)), size },
  cause: Link.parse(cause).toV1(),
  insertedAt: new Date(insertedAt),
})

/**
 * @param {import('@storacha/upload-api').DID} space
 * @param {import('@storacha/upload-api').MultihashDigest} digest
 */
const getKey = (space, digest) =>
  marshall({
    space,
    digest: base58btc.encode(digest.bytes).toString(),
  })
