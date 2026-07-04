const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  isValidIP,
  isPrivateIP,
  buildCacheKey,
  mapCategories,
  getThreatLevel,
  validateIp,
} = require('./validation')
const { createHandler } = require('./index')

describe('abuseipdb validation', () => {
  it('validates IPv4 and IPv6', () => {
    assert.equal(isValidIP('8.8.8.8'), true)
    assert.equal(isValidIP('2001:db8::1'), true)
    assert.equal(isValidIP('999.1.1.1'), false)
    assert.equal(isValidIP('08.8.8.8'), false) // leading zero rejected
  })

  it('detects private/reserved ranges', () => {
    assert.equal(isPrivateIP('10.0.0.1'), true)
    assert.equal(isPrivateIP('127.0.0.1'), true)
    assert.equal(isPrivateIP('::1'), true)
    assert.equal(isPrivateIP('8.8.8.8'), false)
  })

  it('builds a stable cache key', () => {
    assert.equal(buildCacheKey('8.8.8.8'), 'abuseipdb:8.8.8.8')
  })

  it('maps category ids to names', () => {
    assert.deepEqual(mapCategories([22, 999]), [
      { id: 22, name: 'SSH' },
      { id: 999, name: 'Unknown (999)' },
    ])
    assert.deepEqual(mapCategories(undefined), [])
  })

  it('derives threat levels from score', () => {
    assert.equal(getThreatLevel(90).level, 'critical')
    assert.equal(getThreatLevel(60).level, 'high')
    assert.equal(getThreatLevel(30).level, 'medium')
    assert.equal(getThreatLevel(5).level, 'low')
    assert.equal(getThreatLevel(0).level, 'clean')
  })

  it('validateIp returns 400 for missing/invalid/private, null for valid', () => {
    assert.equal(validateIp('8.8.8.8'), null)
    assert.equal(validateIp(undefined)?.statusCode, 400)
    assert.equal(validateIp('bad')?.statusCode, 400)
    assert.equal(validateIp('192.168.1.1')?.statusCode, 400)
  })
})

describe('abuseipdb handler', () => {
  const noCache = { get: async () => null, put: async () => {} }
  const withKey = (over = {}) => ({ apiKey: 'test-key', cache: noCache, ...over })

  it('returns 500 when no API key is configured', async () => {
    const handler = createHandler({ apiKey: '', cache: noCache, fetch: async () => ({ ok: true }) })
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 500)
    assert.equal(res.headers['content-type'], 'application/json')
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
      cache: { get: async () => ({ ip: '8.8.8.8', abuseConfidenceScore: 0 }), put: async () => {} },
      fetch: async () => { fetchCalls++; return { ok: true, json: async () => ({}) } },
    }))
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(fetchCalls, 0)
    assert.equal(JSON.parse(res.body).cached, true)
  })

  it('queries AbuseIPDB, shapes the result and caches it', async () => {
    let putKey = null
    const handler = createHandler(withKey({
      cache: { get: async () => null, put: async (key) => { putKey = key } },
      fetch: async () => ({
        ok: true,
        json: async () => ({
          data: {
            abuseConfidenceScore: 100,
            totalReports: 42,
            countryCode: 'DE',
            reports: [{ categories: [22, 18], reportedAt: 'now', comment: 'x' }],
          },
        }),
      }),
    }))
    const res = await handler({ body: JSON.stringify({ ip: '185.220.101.1' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putKey, 'abuseipdb:185.220.101.1')
    const parsed = JSON.parse(res.body)
    assert.equal(parsed.abuseConfidenceScore, 100)
    assert.equal(parsed.threatLevel.level, 'critical')
    assert.equal(parsed.recentReports.length, 1)
    assert.equal(parsed.cached, false)
  })

  it('returns 502 on upstream error', async () => {
    const handler = createHandler(withKey({
      fetch: async () => ({ ok: false, status: 403, text: async () => 'forbidden' }),
    }))
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 502)
  })
})
