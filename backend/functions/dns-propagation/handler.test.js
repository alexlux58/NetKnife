const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  DNS_RESOLVERS,
  validateRequest,
  buildCacheKey,
  computeConsistency,
} = require('./validation')
const { createHandler } = require('./index')

describe('dns-propagation validation', () => {
  it('rejects missing name and invalid types', () => {
    assert.equal(validateRequest('example.com', 'A'), null)
    assert.equal(validateRequest('', 'A')?.statusCode, 400)
    assert.equal(validateRequest('example.com', 'BOGUS')?.statusCode, 400)
  })

  it('accepts lower-case record types', () => {
    assert.equal(validateRequest('example.com', 'aaaa'), null)
  })

  it('builds a cache key from the raw type', () => {
    assert.equal(buildCacheKey('example.com', 'A'), 'dns-prop-example.com-A')
  })

  it('computes consistency across resolver answers', () => {
    const same = [
      { answers: [{ data: '1.1.1.1' }] },
      { answers: [{ data: '1.1.1.1' }] },
    ]
    const diff = [
      { answers: [{ data: '1.1.1.1' }] },
      { answers: [{ data: '2.2.2.2' }] },
    ]
    assert.equal(computeConsistency(same), true)
    assert.equal(computeConsistency(diff), false)
    assert.equal(computeConsistency([{ error: 'Timeout' }]), false)
  })
})

describe('dns-propagation handler', () => {
  const noCache = { get: async () => null, put: async () => {} }

  it('returns 400 on invalid JSON', async () => {
    const handler = createHandler({ cache: noCache, fetch: async () => ({ ok: true }) })
    const res = await handler({ body: 'not-json' })
    assert.equal(res.statusCode, 400)
  })

  it('returns cached results without querying resolvers', async () => {
    let fetchCalls = 0
    const handler = createHandler({
      cache: { get: async () => ({ name: 'example.com', type: 'A', consistent: true }), put: async () => {} },
      fetch: async () => { fetchCalls++; return { ok: true, json: async () => ({}) } },
    })
    const res = await handler({ body: JSON.stringify({ name: 'example.com', type: 'A' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(fetchCalls, 0)
    assert.equal(JSON.parse(res.body).cached, true)
  })

  it('queries every resolver and reports consistency', async () => {
    let putKey = null
    const handler = createHandler({
      cache: { get: async () => null, put: async (key) => { putKey = key } },
      fetch: async () => ({ ok: true, json: async () => ({ Status: 0, Answer: [{ data: '93.184.216.34', TTL: 300 }] }) }),
    })
    const res = await handler({ body: JSON.stringify({ name: 'example.com', type: 'a' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putKey, 'dns-prop-example.com-a')
    const parsed = JSON.parse(res.body)
    assert.equal(parsed.type, 'A')
    assert.equal(parsed.results.length, DNS_RESOLVERS.length)
    assert.equal(parsed.consistent, true)
    assert.equal(parsed.cached, false)
  })

  it('records a per-resolver error on a failed HTTP response', async () => {
    const handler = createHandler({
      cache: noCache,
      fetch: async () => ({ ok: false, status: 503 }),
    })
    const res = await handler({ body: JSON.stringify({ name: 'example.com', type: 'A' }) })
    const parsed = JSON.parse(res.body)
    assert.equal(parsed.results[0].error, 'HTTP 503')
    assert.equal(parsed.consistent, false)
  })
})
