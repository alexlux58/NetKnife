const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const Stripe = require('stripe')
const {
  parseWebhookRequest,
  verifyStripeEvent,
  processWebhookEvent,
  handleWebhook,
} = require('./webhook')

const TEST_SECRET = 'whsec_test_secret_for_unit_tests'
const stripe = new Stripe('sk_test_unit_test_key')

function signedPayload(payloadObject) {
  const payload = JSON.stringify(payloadObject)
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: TEST_SECRET,
  })
  return { payload, header }
}

describe('billing webhook parsing', () => {
  it('extracts raw body and signature headers', () => {
    const parsed = parseWebhookRequest({
      body: '{"id":"evt_1"}',
      headers: { 'stripe-signature': 'sig_test' },
    })
    assert.equal(parsed.rawBody, '{"id":"evt_1"}')
    assert.equal(parsed.sig, 'sig_test')
  })

  it('decodes base64 webhook bodies', () => {
    const raw = '{"id":"evt_1"}'
    const parsed = parseWebhookRequest({
      body: Buffer.from(raw, 'utf8').toString('base64'),
      isBase64Encoded: true,
      headers: { 'Stripe-Signature': 'sig_test' },
    })
    assert.equal(parsed.rawBody, raw)
  })
})

describe('billing webhook verification', () => {
  it('accepts valid Stripe signatures', () => {
    const event = { id: 'evt_test', type: 'ping', data: { object: {} } }
    const { payload, header } = signedPayload(event)
    const verified = verifyStripeEvent(stripe, payload, header, TEST_SECRET)
    assert.equal(verified.ok, true)
    assert.equal(verified.event.id, 'evt_test')
  })

  it('rejects invalid signatures', () => {
    const verified = verifyStripeEvent(stripe, '{"id":"evt_test"}', 'bad-signature', TEST_SECRET)
    assert.equal(verified.ok, false)
    assert.equal(verified.status, 400)
  })

  it('returns 503 when webhook is not configured', () => {
    const verified = verifyStripeEvent(null, '{}', 'sig', '')
    assert.equal(verified.ok, false)
    assert.equal(verified.status, 503)
  })
})

describe('billing webhook processing', () => {
  it('ignores donation checkouts without upgrading plan', async () => {
    const writes = []
    const result = await processWebhookEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'payment',
          metadata: { type: 'donation', netknife_user_id: 'user-1' },
        },
      },
    }, {
      ddb: { send: async (cmd) => { writes.push(cmd) } },
      billingTable: 'billing',
      stripe: { subscriptions: { retrieve: async () => { throw new Error('should not retrieve') } } },
      PutCommand: class PutCommand { constructor(input) { this.input = input } },
      UpdateCommand: class UpdateCommand { constructor(input) { this.input = input } },
    })

    assert.equal(result.ignored, 'donation')
    assert.equal(writes.length, 0)
  })

  it('upgrades user plan for subscription checkout', async () => {
    const writes = []
    const result = await processWebhookEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          customer: 'cus_123',
          subscription: 'sub_123',
          metadata: { netknife_user_id: 'user-1' },
        },
      },
    }, {
      ddb: { send: async (cmd) => { writes.push(cmd) } },
      billingTable: 'billing',
      stripe: { subscriptions: { retrieve: async () => ({ current_period_end: 1893456000 }) } },
      PutCommand: class PutCommand { constructor(input) { this.input = input } },
      UpdateCommand: class UpdateCommand { constructor(input) { this.input = input } },
    })

    assert.equal(result.applied, 'subscription')
    assert.equal(writes.length, 1)
    assert.equal(writes[0].input.Item.planId, 'pro')
  })
})

describe('billing webhook handler', () => {
  it('returns 400 for tampered payloads', async () => {
    const result = await handleWebhook('{"id":"evt_test"}', 'invalid', {
      stripe,
      webhookSecret: TEST_SECRET,
      ddb: { send: async () => {} },
      billingTable: 'billing',
      PutCommand: class PutCommand {},
      UpdateCommand: class UpdateCommand {},
    })
    assert.equal(result.status, 400)
  })
})
