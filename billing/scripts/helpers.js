import Big from 'big.js'
import { StoreOperationFailure } from '../tables/lib.js'
import { EndOfQueue } from '../test/helpers/queue.js'

/**
 * @template T
 * @returns {import('../lib/api.js').QueueAdder<T> & import('../test/lib/api.js').QueueRemover<T>}
 */
export const createMemoryQueue = () => {
  /** @type {T[]} */
  const items = []
  return {
    add: async (message) => {
      items.push(message)
      return { ok: {} }
    },
    remove: async () => {
      const item = items.shift()
      return item ? { ok: item } : { error: new EndOfQueue() }
    }
  }
}

/**
 * @template T
 * @returns {import('../lib/api.js').StorePutter<T> & import('../lib/api.js').StoreLister<any, T> & import('../lib/api.js').StoreGetter<any, T>}
 */
export const createMemoryStore = () => {
  /** @type {T[]} */
  const items = []
  return {
    put: async (item) => {
      items.push(item)
      return { ok: {} }
    },
    get: async () => ({ error: new StoreOperationFailure('not implemented') }),
    list: async () => ({ ok: { results: items } })
  }
}

const GB = 1024 * 1024 * 1024
const TB = 1024 * GB

/** @type {Record<string, { cost: number, overage: number, included: number }>} */
const productInfo = {
  'did:web:storage.starter.plan.storacha.network': { cost: 0, overage: 0.15 / GB, included: 5 * GB },
  'did:web:storage.lite.plan.storacha.network': { cost: 10, overage: 0.05 / GB, included: 100 * GB },
  'did:web:storage.business.plan.storacha.network': { cost: 100, overage: 0.03 / GB, included: 2 * TB },
  'did:web:storage.free.plan.storacha.network': { cost: 0, overage: 0 / GB, included: 0 }
}

/**
 * @param {string} product
 * @param {bigint} usage Usage in bytes/ms
 * @param {number} duration Duration in ms
 */
export const calculateCost = (product, usage, duration) => {
  const info = productInfo[product]
  if (!info) throw new Error(`missing product info: ${product}`)

  let quantity = Math.floor(new Big(usage.toString()).div(duration).div(GB).toNumber())
  quantity = quantity - (info.included / GB)
  quantity = quantity < 0 ? 0 : quantity

  return info.cost + (quantity * GB * info.overage)
}
