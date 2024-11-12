// import whyIsNodeRunning from 'why-is-node-running'
import { describe, it, after } from 'mocha'
import assert from 'node:assert'
import { base58btc } from 'multiformats/bases/base58'
import { createClient, setupClient } from './helpers/client.js'

describe('e2e', () => {
  // after(() => {
  //   setTimeout(() => whyIsNodeRunning(), 5000)
  // })

  it('upload a blob', async function () {
    this.timeout(5 * 60 * 1000)

    const client = await createClient()
    await setupClient(client)

    const bytes = crypto.getRandomValues(new Uint8Array(128))
    const blob = new Blob([bytes])

    let shard
    const root = await client.uploadFile(blob, {
      onShardStored: (meta) => {
        shard = meta.cid
        console.log(`shard:   ${shard} (${base58btc.encode(shard.multihash.bytes)})`)
      }
    })
    assert(shard)

    console.log(`root:    ${root}`)
    console.log(`gateway: https://staging.w3s.link/ipfs/${root}`)
  })
})
