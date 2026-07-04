const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { isValidQuery, buildCacheKey, validateQuery } = require('./validation')
const { createHandler } = require('./index')

describe('bgp-looking-glass validation', () => {
  it('accepts IPv4, IPv4 CIDR, and IPv6', () => {
    assert.equal(isValidQuery('8.8.8.8'), true)
    assert.equal(isValidQuery('8.8.8.0/24'), true)
    assert.equal(isValidQuery('2001:db8::1'), true)
  })

  it('rejects non IP/CIDR input', () => {
    assert.equal(isValidQuery('example.com'), false)
    assert.equal(isValidQuery('nope'), false)
  })

  it('builds a stable cache key', () => {
    assert.equal(buildCacheKey('8.8.8.0/24'), 'bgp-lg-8.8.8.0/24')
  })

  it('validateQuery returns 400 for invalid, null for valid', () => {
    assert.equal(validateQuery('8.8.8.8'), null)
    assert.equal(validateQuery('bad')?.statusCode, 400)
    assert.equal(validateQuery(undefined)?.statusCode, 400)
  })
})

describe('bgp-looking-glass handler', () => {
  const noCache = { get: async () => null, put: async () => {} }

  it('returns 400 for an invalid query without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler({ cache: noCache, fetch: async () => { fetchCalls++; return { json: async () => ({}) } } })
    const res = await handler({ body: JSON.stringify({ query: 'not-an-ip' }) })
    assert.equal(res.statusCode, 400)
    assert.equal(fetchCalls, 0)
  })

  it('returns cached results without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler({
      cache: { get: async () => ({ query: '8.8.8.8', prefix: '8.8.8.0/24' }), put: async () => {} },
      fetch: async () => { fetchCalls++; return { json: async () => ({}) } },
    })
    const res = await handler({ body: JSON.stringify({ query: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(fetchCalls, 0)
    assert.equal(JSON.parse(res.body).cached, true)
  })

  it('aggregates the three RIPEstat endpoints and caches the result', async () => {
    let putKey = null
    const handler = createHandler({
      cache: { get: async () => null, put: async (key) => { putKey = key } },
      fetch: async (url) => {
        if (url.includes('prefix-overview')) {
          return { json: async () => ({ data: { resource: '8.8.8.0/24', asns: [{ asn: 15169, holder: 'GOOGLE' }] } }) }
        }
        if (url.includes('routing-status')) {
          return { json: async () => ({ data: { visibility: { v4: 100 }, announced_space: 256 } }) }
        }
        return { json: async () => ({ data: { rrcs: [{ rrc: 'rrc00', location: 'AMS', peers: [{ asn_origin: 15169, as_path: '1 2 15169' }] }] } }) }
      },
    })
    const res = await handler({ body: JSON.stringify({ query: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putKey, 'bgp-lg-8.8.8.8')
    const parsed = JSON.parse(res.body)
    assert.equal(parsed.prefix, '8.8.8.0/24')
    assert.equal(parsed.originAsns[0].asn, 15169)
    assert.equal(parsed.visibility.v4Visibility, 100)
    assert.equal(parsed.routes[0].peers[0].asn, 15169)
    assert.equal(parsed.cached, false)
  })

  it('returns 500 when RIPEstat fetch fails', async () => {
    const handler = createHandler({
      cache: noCache,
      fetch: async () => { throw new Error('network down') },
    })
    const res = await handler({ body: JSON.stringify({ query: '8.8.8.8' }) })
    assert.equal(res.statusCode, 500)
    assert.match(JSON.parse(res.body).error, /BGP lookup failed/)
  })
})
