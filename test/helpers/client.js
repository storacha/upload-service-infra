import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import * as DID from '@ipld/dag-ucan/did'
import * as Client from '@storacha/client'
import { StoreMemory } from '@storacha/client/stores/memory'
import { MailSlurp } from 'mailslurp-client'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config({ path: fileURLToPath(new URL('../../.env.local', import.meta.url)) })

const uploadServiceDID = 'did:web:staging.upload.storacha.network'
const uploadServiceURL = 'https://staging.upload.storacha.network'
const receiptsEndpoint = `${uploadServiceURL}/receipt/`

/** @param {string} text */
const scrapeAuthLink = (text) => {
  // forgive me for I have s̵i̵n̴n̴e̵d̴ ̸a̸n̵d̷ ̷p̶a̵r̵s̵e̸d̷ Ȟ̷̞T̷̢̈́M̸̼̿L̴̎ͅ ̵̗̍ẅ̵̝́ï̸ͅt̴̬̅ḫ̸̔ ̵͚̔ŗ̵͊e̸͍͐g̶̜͒ė̷͖x̴̱̌
  // TODO we should update the email and add an ID to this element to make this more robust - tracked in https://github.com/web3-storage/w3infra/issues/208
  const link = text.match(/<a href="([^"]*)".*Verify email address/)[1]
  if (!link){
    throw new Error(`Could not find email verification link in ${email}`)
  }
  return link
}

export const createMailslurpInbox = async () => {
  const apiKey = process.env.MAILSLURP_API_KEY
  const mailslurp = new MailSlurp({ apiKey })
  const inbox = await mailslurp.inboxController.createInbox({})
  return {
    mailslurp,
    id: inbox.id,
    email: inbox.emailAddress
  }
}

export const createClient = () => {
  const conn = uploadServiceConnection()
  return Client.create({
    store: new StoreMemory(),
    serviceConf: { access: conn, upload: conn, filecoin: conn },
    receiptsEndpoint: new URL(receiptsEndpoint)
  })
}

/**
 * @param {import('@storacha/client').Client} client
 */
export const setupClient = async (client) => {
  const { mailslurp, id: inboxId, email } = await createMailslurpInbox()
  const timeoutMs = process.env.MAILSLURP_TIMEOUT ? parseInt(process.env.MAILSLURP_TIMEOUT) : 60_000
  const [account] = await Promise.all([
    client.login(email),
    (async () => {
      const latestEmail = await mailslurp.waitForLatestEmail(inboxId, timeoutMs)
      const authLink = scrapeAuthLink(latestEmail.body)
      const res = await fetch(authLink, { method: 'POST' })
      if (!res.ok) {
        throw new Error('failed to authenticate by clickling on auth link from e-mail')
      }
    })()
  ])

  if (!client.currentSpace()) {
    const space = await client.createSpace("test space")
    await account.provision(space.did())
    await space.save()
  }
  return account
}

const uploadServiceConnection = () => connect({
  id: DID.parse(uploadServiceDID),
  codec: CAR.outbound,
  channel: HTTP.open({
    url: new URL(uploadServiceURL),
    method: 'POST'
  }),
})
