import { describe, it } from 'mocha'
import assert from 'node:assert'
import { createClient, setupClient } from './helpers/client.js'
imp

describe('e2e', () => {
  it('does a test', async () => {
    const client = await createClient()
    await setupClient(client)

    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const blob = new Blob([bytes])

    let shard
    const root = await client.uploadFile(blob, {
      onShardStored: (meta) => {
        shard = meta.cid
        console.log(`stored shard: ${shard}`)
      }
    })
    assert(shard)

    console.log(`https://staging.w3s.link/ipfs/${root}`)
    
    assert(true)
  })
})
