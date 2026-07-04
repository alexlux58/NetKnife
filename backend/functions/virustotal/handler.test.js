const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { validateRequest, buildTarget } = require('./validation')
const { createHandler } = require('./index')

describe('virustotal validation', () => {
  it('rejects missing type/value', () => {
    assert.equal(validateRequest('ip', '8.8.8.8'), null)
    assert.equal(validateRequest(undefined, '8.8.8.8')?.statusCode, 400)
    assert.equal(validateRequest('ip', undefined)?.statusCode, 400)
  })

  it('rejects unknown types', () => {
    assert.equal(validateRequest('file', 'x')?.statusCode, 400)
  })

  it('builds targets and cache keys per type', () => {
    assert.deepEqual(buildTarget('ip', '8.8.8.8'), {
      apiUrl: 'https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8',
      cacheKey: 'vt-ip-8.8.8.8',
    })
    assert.deepEqual(buildTarget('domain', 'example.com'), {
      apiUrl: 'https://www.virustotal.com/api/v3/domains/example.com',
      cacheKey: 'vt-domain-example.com',
    })
    const url = buildTarget('url', 'https://example.com/path')
    const expectedId = Buffer.from('https://example.com/path').toString('base64').replace(/=/g, '')
    assert.equal(url.cacheKey, `vt-url-${expectedId}`)
    assert.ok(!url.apiUrl.includes('='))
  })
})

describe('virustotal handler', () => {
  const noCache = { get: async () => null, put: async () => {} }
  const withKey = (over = {}) => ({ apiKey: 'test-key', cache: noCache, ...over })

  it('returns 501 without an API key', async () => {
    const handler = createHandler({ apiKey: '', cache: noCache, fetch: async () => ({ ok: true }) })
    const res = await handler({ body: JSON.stringify({ type: 'ip', value: '8.8.8.8' }) })
    assert.equal(res.statusCode, 501)
  })

  it('returns 400 for an invalid type without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler(withKey({ fetch: async () => { fetchCalls++; return { ok: true } } }))
    const res = await handler({ body: JSON.stringify({ type: 'file', value: 'x' }) })
    assert.equal(res.statusCode, 400)
    assert.equal(fetchCalls, 0)
  })

  it('returns cached results without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler(withKey({
      cache: { get: async () => ({ type: 'ip', value: '8.8.8.8', reputation: 0 }), put: async () => {} },
      fetch: async () => { fetchCalls++; return { ok: true, json: async () => ({}) } },
    }))
    const res = await handler({ body: JSON.stringify({ type: 'ip', value: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(fetchCalls, 0)
    assert.equal(JSON.parse(res.body).cached, true)
  })

  it('maps a 429 to a rate-limit error', async () => {
    const handler = createHandler(withKey({ fetch: async () => ({ ok: false, status: 429 }) }))
    const res = await handler({ body: JSON.stringify({ type: 'ip', value: '8.8.8.8' }) })
    assert.equal(res.statusCode, 429)
  })

  it('shapes a successful response, filters malicious engines, and caches', async () => {
    let putKey = null
    const handler = createHandler(withKey({
      cache: { get: async () => null, put: async (key) => { putKey = key } },
      fetch: async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: '8.8.8.8',
            attributes: {
              reputation: 5,
              as_owner: 'Google LLC',
              last_analysis_results: {
                EngineA: { category: 'malicious', result: 'phishing' },
                EngineB: { category: 'harmless', result: 'clean' },
              },
            },
          },
        }),
      }),
    }))
    const res = await handler({ body: JSON.stringify({ type: 'ip', value: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putKey, 'vt-ip-8.8.8.8')
    const parsed = JSON.parse(res.body)
    assert.equal(parsed.asOwner, 'Google LLC')
    assert.equal(parsed.lastAnalysisResults.length, 1)
    assert.equal(parsed.lastAnalysisResults[0].engine, 'EngineA')
    assert.equal(parsed.cached, false)
  })
})
