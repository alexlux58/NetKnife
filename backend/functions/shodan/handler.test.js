const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { isValidIP, isValidHostname, isPrivateIP, buildCacheKey } = require('./validation')
const { createHandler } = require('./index')

describe('shodan validation', () => {
  it('accepts IPv4 and IPv6 forms', () => {
    assert.equal(isValidIP('8.8.8.8'), true)
    assert.equal(isValidIP('2001:db8::1'), true)
    assert.equal(isValidIP('not-an-ip'), false)
  })

  it('validates hostnames', () => {
    assert.equal(isValidHostname('example.com'), true)
    assert.equal(isValidHostname('sub.example.co.uk'), true)
    assert.equal(isValidHostname('bad host'), false)
  })

  it('detects private/reserved ranges', () => {
    assert.equal(isPrivateIP('10.0.0.1'), true)
    assert.equal(isPrivateIP('127.0.0.1'), true)
    assert.equal(isPrivateIP('0.0.0.0'), true)
    assert.equal(isPrivateIP('8.8.8.8'), false)
  })

  it('keys the cache on the resolved IP', () => {
    assert.equal(buildCacheKey('1.2.3.4'), 'shodan-1.2.3.4')
  })
})

describe('shodan handler', () => {
  const noCache = { get: async () => null, put: async () => {} }
  const withKey = (over = {}) => ({ apiKey: 'test-key', cache: noCache, ...over })

  it('returns 501 when no API key is configured', async () => {
    const handler = createHandler({ apiKey: '', cache: noCache })
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 501)
  })

  it('rejects a private IP without querying Shodan', async () => {
    let fetchCalls = 0
    const handler = createHandler(withKey({ fetch: async () => { fetchCalls++; return { ok: true } } }))
    const res = await handler({ body: JSON.stringify({ ip: '10.0.0.1' }) })
    assert.equal(res.statusCode, 400)
    assert.equal(fetchCalls, 0)
  })

  it('returns cached results without calling fetch', async () => {
    let fetchCalls = 0
    const handler = createHandler(withKey({
      cache: { get: async () => ({ ip: '8.8.8.8', ports: [443] }), put: async () => {} },
      fetch: async () => { fetchCalls++; return { ok: true, json: async () => ({}) } },
    }))
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(fetchCalls, 0)
    assert.equal(JSON.parse(res.body).cached, true)
  })

  it('maps a Shodan 404 to a 404 with the resolved IP', async () => {
    const handler = createHandler(withKey({ fetch: async () => ({ ok: false, status: 404 }) }))
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 404)
    assert.equal(JSON.parse(res.body).ip, '8.8.8.8')
  })

  it('maps a Shodan 401 to an invalid-key error', async () => {
    const handler = createHandler(withKey({ fetch: async () => ({ ok: false, status: 401 }) }))
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 401)
  })

  it('shapes a successful response and caches it', async () => {
    let putKey = null
    const handler = createHandler(withKey({
      cache: { get: async () => null, put: async (key) => { putKey = key } },
      fetch: async () => ({
        ok: true,
        json: async () => ({
          ip_str: '8.8.8.8',
          ports: [53, 443],
          vulns: ['CVE-2021-0001'],
          data: [{ port: 443, transport: 'tcp', product: 'nginx', data: 'banner' }],
        }),
      }),
    }))
    const res = await handler({ body: JSON.stringify({ ip: '8.8.8.8' }) })
    assert.equal(res.statusCode, 200)
    assert.equal(putKey, 'shodan-8.8.8.8')
    const parsed = JSON.parse(res.body)
    assert.equal(parsed.ip, '8.8.8.8')
    assert.deepEqual(parsed.ports, [53, 443])
    assert.equal(parsed.services[0].product, 'nginx')
    assert.equal(parsed.cached, false)
  })

  it('resolves a hostname via DoH before querying Shodan', async () => {
    const calls = []
    const handler = createHandler(withKey({
      fetch: async (url) => {
        calls.push(url)
        if (url.includes('cloudflare-dns.com')) {
          return { ok: true, json: async () => ({ Answer: [{ data: '1.2.3.4' }] }) }
        }
        return { ok: true, json: async () => ({ ip_str: '1.2.3.4', ports: [] }) }
      },
    }))
    const res = await handler({ body: JSON.stringify({ ip: 'example.com' }) })
    assert.equal(res.statusCode, 200)
    assert.ok(calls[0].includes('cloudflare-dns.com'))
    assert.ok(calls[1].includes('/shodan/host/1.2.3.4'))
    assert.equal(JSON.parse(res.body).originalInput, 'example.com')
  })
})
