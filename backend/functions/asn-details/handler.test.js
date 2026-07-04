const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { parseAsn, buildCacheKey, validateAsn } = require('./validation')
const { createHandler } = require('./index')

describe('asn-details validation', () => {
  it('parses ASN in several formats', () => {
    assert.equal(parseAsn('13335'), 13335)
    assert.equal(parseAsn('AS13335'), 13335)
    assert.equal(parseAsn('as13335'), 13335)
  })

  it('rejects non-ASN input', () => {
    assert.equal(parseAsn('abc'), null)
    assert.equal(parseAsn('AS13a'), null)
  })

  it('builds a stable cache key', () => {
    assert.equal(buildCacheKey(13335), 'asn-13335')
  })

  it('validateAsn enforces the 1..4294967295 range', () => {
    assert.equal(validateAsn(13335), null)
    assert.equal(validateAsn(0)?.statusCode, 400)
    assert.equal(validateAsn(4294967296)?.statusCode, 400)
    assert.equal(validateAsn(null)?.statusCode, 400)
  })
})

describe('asn-details handler', () => {
  const noCache = { get: async () => null, put: async () => {} }

  it('returns 400 on invalid JSON body', async () => {
    const handler = createHandler({ cache: noCache, fetch: async () => ({ ok: true }) })
    const res = await handler({ body: 'not-json' })
    assert.equal(res.statusCode, 400)
    assert.equal(res.headers['Content-Type'], 'application/json')
  })

  it('returns 400 for an invalid ASN without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler({
      cache: noCache,
      fetch: async () => { fetchCalls++; return { ok: true, json: async () => ({}) } },
    })
    const res = await handler({ body: JSON.stringify({ asn: 'nope' }) })
    assert.equal(res.statusCode, 400)
    assert.equal(fetchCalls, 0)
  })

  it('returns cached results without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler({
      cache: { get: async () => ({ asn: 13335, name: 'CLOUDFLARENET' }), put: async () => {} },
      fetch: async () => { fetchCalls++; return { ok: true, json: async () => ({}) } },
    })
    const res = await handler({ body: JSON.stringify({ asn: 'AS13335' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(fetchCalls, 0)
    assert.equal(JSON.parse(res.body).cached, true)
  })

  it('fetches from BGPView and caches on success', async () => {
    let putKey = null
    const okJson = (data) => ({ ok: true, json: async () => ({ status: 'ok', data }) })
    const handler = createHandler({
      cache: { get: async () => null, put: async (key) => { putKey = key } },
      fetch: async (url) => {
        if (url.endsWith('/13335')) return okJson({ name: 'CLOUDFLARENET', country_code: 'US' })
        return okJson({})
      },
    })
    const res = await handler({ body: JSON.stringify({ asn: '13335' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putKey, 'asn-13335')
    const parsed = JSON.parse(res.body)
    assert.equal(parsed.name, 'CLOUDFLARENET')
    assert.equal(parsed.cached, false)
  })

  it('returns 404 when BGPView reports the ASN is not found', async () => {
    const handler = createHandler({
      cache: noCache,
      fetch: async () => ({ ok: true, json: async () => ({ status: 'error', data: null }) }),
    })
    const res = await handler({ body: JSON.stringify({ asn: '99999999' }) })
    assert.equal(res.statusCode, 404)
  })
})
