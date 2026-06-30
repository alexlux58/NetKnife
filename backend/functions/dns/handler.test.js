const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  isValidDomain,
  normalizeDnsRequest,
  validateDnsRequest,
  ALLOWED_TYPES,
} = require('./validation')

describe('dns validation', () => {
  it('accepts valid domain names', () => {
    assert.equal(isValidDomain('example.com'), true)
    assert.equal(isValidDomain('sub.example.co.uk'), true)
  })

  it('rejects invalid domain names', () => {
    assert.equal(isValidDomain(''), false)
    assert.equal(isValidDomain('bad_domain'), false)
    assert.equal(isValidDomain('a'.repeat(254)), false)
  })

  it('normalizes request fields', () => {
    assert.deepEqual(normalizeDnsRequest({ name: ' Example.COM ', type: 'mx' }), {
      name: 'example.com',
      type: 'MX',
    })
  })

  it('validates allowed record types', () => {
    assert.equal(validateDnsRequest('example.com', 'A'), null)
    assert.equal(validateDnsRequest('example.com', 'PTR')?.statusCode, 400)
    assert.ok(ALLOWED_TYPES.has('AAAA'))
  })
})

describe('dns handler', () => {
  it('returns cached responses without calling fetch', async () => {
    const { createHandler } = require('./index')
    let fetchCalls = 0

    const handler = createHandler({
      cacheTable: 'cache-table',
      dynamodb: {
        send: async (command) => {
          if (command.constructor.name === 'GetCommand') {
            return {
              Item: {
                cache_key: 'dns:A:example.com',
                value: {
                  name: 'example.com',
                  type: 'A',
                  status: 0,
                  answer: [{ data: '93.184.216.34' }],
                  authority: [],
                  comment: null,
                },
                expires_at: Math.floor(Date.now() / 1000) + 60,
              },
            }
          }
          return {}
        },
      },
      fetch: async () => {
        fetchCalls += 1
        throw new Error('fetch should not be called for cache hit')
      },
    })

    const response = await handler({
      body: JSON.stringify({ name: 'example.com', type: 'A' }),
    })

    assert.equal(response.statusCode, 200)
    assert.equal(fetchCalls, 0)
    const payload = JSON.parse(response.body)
    assert.equal(payload.cached, true)
    assert.equal(payload.answer[0].data, '93.184.216.34')
  })

  it('queries DoH when cache misses', async () => {
    const { createHandler } = require('./index')
    const handler = createHandler({
      cacheTable: null,
      fetch: async (url) => ({
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [{ data: '1.2.3.4' }],
          Authority: [],
        }),
        url,
      }),
    })

    const response = await handler({
      body: JSON.stringify({ name: 'example.com', type: 'A' }),
    })

    assert.equal(response.statusCode, 200)
    const payload = JSON.parse(response.body)
    assert.equal(payload.cached, false)
    assert.equal(payload.answer[0].data, '1.2.3.4')
  })

  it('returns 400 for invalid domains', async () => {
    const { createHandler } = require('./index')
    const handler = createHandler({ cacheTable: null })
    const response = await handler({ body: JSON.stringify({ name: 'bad_domain' }) })
    assert.equal(response.statusCode, 400)
    assert.match(JSON.parse(response.body).error, /Invalid domain/)
  })
})
