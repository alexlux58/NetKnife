const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  isValidIP,
  normalizeIpRequest,
  buildCacheKey,
  validateIpRequest,
} = require('./validation')
const { createHandler } = require('./index')

describe('ip-api validation', () => {
  it('accepts valid IPv4 addresses', () => {
    assert.equal(isValidIP('8.8.8.8'), true)
    assert.equal(isValidIP('192.168.0.1'), true)
  })

  it('rejects invalid IPv4 addresses', () => {
    assert.equal(isValidIP('999.1.1.1'), false)
    assert.equal(isValidIP('not-an-ip'), false)
    assert.equal(isValidIP(''), false)
  })

  it('accepts basic IPv6 addresses', () => {
    assert.equal(isValidIP('2001:4860:4860::8888'), true)
  })

  it('normalizes the request body', () => {
    assert.equal(normalizeIpRequest({ ip: '  8.8.8.8 ' }), '8.8.8.8')
    assert.equal(normalizeIpRequest({}), '')
  })

  it('builds a stable cache key', () => {
    assert.equal(buildCacheKey('8.8.8.8'), 'ipapi:8.8.8.8')
  })

  it('validateIpRequest returns 400 for missing/invalid ip', () => {
    assert.equal(validateIpRequest('8.8.8.8'), null)
    assert.equal(validateIpRequest('')?.statusCode, 400)
    assert.equal(validateIpRequest('bad')?.statusCode, 400)
  })
})

describe('ip-api handler', () => {
  const noCache = { get: async () => null, put: async () => {} }

  it('rejects a missing ip without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler({
      cache: noCache,
      fetch: async () => {
        fetchCalls++
        return { ok: true, json: async () => ({}) }
      },
    })

    const res = await handler({ body: JSON.stringify({}) })
    assert.equal(res.statusCode, 400)
    assert.equal(fetchCalls, 0)
    assert.equal(res.headers['Content-Type'], 'application/json')
  })

  it('returns cached results without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler({
      cache: {
        get: async () => ({ status: 'success', country: 'United States' }),
        put: async () => {},
      },
      fetch: async () => {
        fetchCalls++
        return { ok: true, json: async () => ({}) }
      },
    })

    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(fetchCalls, 0)
    assert.deepEqual(JSON.parse(res.body), {
      status: 'success',
      country: 'United States',
      cached: true,
    })
  })

  it('queries the API and caches on success', async () => {
    let putKey = null
    const handler = createHandler({
      cache: { get: async () => null, put: async (key) => { putKey = key } },
      fetch: async () => ({
        ok: true,
        json: async () => ({ status: 'success', country: 'United States', query: '8.8.8.8' }),
      }),
    })

    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putKey, 'ipapi:8.8.8.8')
    assert.equal(JSON.parse(res.body).cached, false)
  })

  it('maps an upstream "fail" status to a 400', async () => {
    const handler = createHandler({
      cache: noCache,
      fetch: async () => ({
        ok: true,
        json: async () => ({ status: 'fail', message: 'reserved range' }),
      }),
    })

    const res = await handler({ body: JSON.stringify({ ip: '10.0.0.1' }) })
    assert.equal(res.statusCode, 400)
    assert.equal(JSON.parse(res.body).error, 'reserved range')
  })
})
