const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { isValidIP, isPrivateIP, buildCacheKey, validateIp } = require('./validation')
const { createHandler } = require('./index')

describe('greynoise validation', () => {
  it('accepts valid IPv4 and rejects other input', () => {
    assert.equal(isValidIP('8.8.8.8'), true)
    assert.equal(isValidIP('2001:db8::1'), false)
    assert.equal(isValidIP('nope'), false)
  })

  it('detects private ranges', () => {
    assert.equal(isPrivateIP('10.0.0.1'), true)
    assert.equal(isPrivateIP('192.168.1.1'), true)
    assert.equal(isPrivateIP('172.16.0.1'), true)
    assert.equal(isPrivateIP('8.8.8.8'), false)
  })

  it('builds a stable cache key', () => {
    assert.equal(buildCacheKey('8.8.8.8'), 'greynoise-8.8.8.8')
  })

  it('validateIp returns 400 for invalid/private, null for valid', () => {
    assert.equal(validateIp('8.8.8.8'), null)
    assert.equal(validateIp('bad')?.statusCode, 400)
    assert.equal(validateIp('10.0.0.1')?.statusCode, 400)
  })
})

describe('greynoise handler', () => {
  const noCache = { get: async () => null, put: async () => {} }
  const withKey = (over = {}) => ({ apiKey: 'test-key', cache: noCache, ...over })

  it('returns 501 when no API key is configured', async () => {
    const handler = createHandler({ apiKey: '', cache: noCache, fetch: async () => ({ ok: true }) })
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 501)
  })

  it('rejects a private IP without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler(withKey({ fetch: async () => { fetchCalls++; return { ok: true } } }))
    const res = await handler({ body: JSON.stringify({ ip: '10.0.0.1' }) })
    assert.equal(res.statusCode, 400)
    assert.equal(fetchCalls, 0)
  })

  it('returns cached results without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler(withKey({
      cache: { get: async () => ({ ip: '8.8.8.8', classification: 'benign' }), put: async () => {} },
      fetch: async () => { fetchCalls++; return { ok: true, json: async () => ({}) } },
    }))
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(fetchCalls, 0)
    assert.equal(JSON.parse(res.body).cached, true)
  })

  it('treats a 404 as "not observed" and caches it', async () => {
    let putKey = null
    const handler = createHandler(withKey({
      cache: { get: async () => null, put: async (key) => { putKey = key } },
      fetch: async () => ({ ok: false, status: 404 }),
    }))
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putKey, 'greynoise-8.8.8.8')
    assert.equal(JSON.parse(res.body).classification, 'unknown')
  })

  it('maps a 429 to a rate-limit error', async () => {
    const handler = createHandler(withKey({ fetch: async () => ({ ok: false, status: 429 }) }))
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 429)
  })

  it('shapes a successful response and caches it', async () => {
    let putKey = null
    const handler = createHandler(withKey({
      cache: { get: async () => null, put: async (key) => { putKey = key } },
      fetch: async () => ({
        ok: true,
        json: async () => ({ noise: true, classification: 'malicious', name: 'ACME' }),
      }),
    }))
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putKey, 'greynoise-8.8.8.8')
    const parsed = JSON.parse(res.body)
    assert.equal(parsed.noise, true)
    assert.equal(parsed.classification, 'malicious')
    assert.equal(parsed.cached, false)
  })
})
