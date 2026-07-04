const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { sanitizeParam, validateAsn, parseRequest, ALLOWED_RESOURCES } = require('./validation')
const { createHandler } = require('./index')

describe('peeringdb validation', () => {
  it('sanitizes names and strips dangerous characters', () => {
    assert.equal(sanitizeParam('Cloudflare'), 'Cloudflare')
    assert.equal(sanitizeParam('drop; table--'), 'drop table--')
    assert.equal(sanitizeParam(123), '')
  })

  it('validates ASN as numeric with a length cap', () => {
    assert.equal(validateAsn('AS13335'), '13335')
    assert.equal(validateAsn('13335'), '13335')
    assert.equal(validateAsn('12345678901'), '') // > 10 digits
  })

  it('whitelists resource types', () => {
    assert.ok(ALLOWED_RESOURCES.has('net'))
    assert.equal(ALLOWED_RESOURCES.has('bogus'), false)
  })

  it('parseRequest rejects bad resource and missing params', () => {
    assert.equal(parseRequest({ resource: 'bogus', asn: '13335' }).error?.statusCode, 400)
    assert.equal(parseRequest({ resource: 'net' }).error?.statusCode, 400)
  })

  it('parseRequest builds query string and cache key', () => {
    const parsed = parseRequest({ resource: 'net', asn: '13335' })
    assert.equal(parsed.error, undefined)
    assert.equal(parsed.queryString, 'asn=13335')
    assert.equal(parsed.cacheKey, 'peeringdb:net:asn=13335')
  })
})

describe('peeringdb handler', () => {
  const noCache = { get: async () => null, put: async () => {} }

  it('returns 400 for an invalid resource without fetching', async () => {
    let fetchCalls = 0
    const handler = createHandler({ cache: noCache, fetch: async () => { fetchCalls++; return { json: async () => ({}) } } })
    const res = await handler({ body: JSON.stringify({ resource: 'bogus', asn: '13335' }) })
    assert.equal(res.statusCode, 400)
    assert.equal(fetchCalls, 0)
  })

  it('returns 400 when neither asn nor name is provided', async () => {
    const handler = createHandler({ cache: noCache })
    const res = await handler({ body: JSON.stringify({ resource: 'net' }) })
    assert.equal(res.statusCode, 400)
  })

  it('returns cached results without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler({
      cache: { get: async () => ({ resource: 'net', asn: '13335', data: { data: [] } }), put: async () => {} },
      fetch: async () => { fetchCalls++; return { json: async () => ({}) } },
    })
    const res = await handler({ body: JSON.stringify({ resource: 'net', asn: '13335' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(fetchCalls, 0)
    assert.equal(JSON.parse(res.body).cached, true)
  })

  it('fetches, shapes, and caches a successful response', async () => {
    let putKey = null
    const handler = createHandler({
      cache: { get: async () => null, put: async (key) => { putKey = key } },
      fetch: async (url) => {
        assert.ok(url.includes('/net?asn=13335'))
        return { ok: true, status: 200, json: async () => ({ data: [{ asn: 13335, name: 'CLOUDFLARENET' }] }) }
      },
    })
    const res = await handler({ body: JSON.stringify({ resource: 'net', asn: '13335' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putKey, 'peeringdb:net:asn=13335')
    const parsed = JSON.parse(res.body)
    assert.equal(parsed.status, 200)
    assert.equal(parsed.data.data[0].name, 'CLOUDFLARENET')
    assert.equal(parsed.cached, false)
  })

  it('returns 200 but does not cache a PeeringDB 404', async () => {
    let putCalls = 0
    const handler = createHandler({
      cache: { get: async () => null, put: async () => { putCalls++ } },
      fetch: async () => ({ ok: false, status: 404, json: async () => ({ data: [] }) }),
    })
    const res = await handler({ body: JSON.stringify({ resource: 'net', asn: '13335' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putCalls, 0)
    assert.equal(JSON.parse(res.body).status, 404)
  })

  it('maps an abort/timeout to 504', async () => {
    const handler = createHandler({
      cache: noCache,
      fetch: async () => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        throw err
      },
    })
    const res = await handler({ body: JSON.stringify({ resource: 'net', asn: '13335' }) })
    assert.equal(res.statusCode, 504)
  })
})
