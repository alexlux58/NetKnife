const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { validateTracerouteTarget } = require('./validation')

describe('traceroute validation', () => {
  it('accepts public targets', () => {
    assert.equal(validateTracerouteTarget('1.1.1.1').ok, true)
    assert.equal(validateTracerouteTarget('cloudflare.com').ok, true)
  })

  it('rejects private IPs and malformed targets', () => {
    assert.equal(validateTracerouteTarget('192.168.1.1').ok, false)
    assert.equal(validateTracerouteTarget('bad host').ok, false)
  })
})

describe('traceroute handler', () => {
  it('blocks private IPs resolved from DNS', async () => {
    const { createHandler } = require('./index')
    const handler = createHandler({
      cacheTable: null,
      fetch: async (url) => {
        if (url.includes('cloudflare-dns.com')) {
          return {
            ok: true,
            json: async () => ({ Answer: [{ data: '127.0.0.1' }] }),
          }
        }
        throw new Error('unexpected fetch')
      },
    })

    const response = await handler({
      body: JSON.stringify({ target: 'internal.example.com' }),
    })

    assert.equal(response.statusCode, 400)
    assert.match(JSON.parse(response.body).error, /private/)
  })

  it('returns AS path data for public targets', async () => {
    const { createHandler } = require('./index')
    const handler = createHandler({
      cacheTable: null,
      fetch: async (url) => {
        if (url.includes('cloudflare-dns.com')) {
          return {
            ok: true,
            json: async () => ({ Answer: [{ data: '1.1.1.1' }] }),
          }
        }
        if (url.includes('looking-glass')) {
          return {
            ok: true,
            json: async () => ({ data: { rrcs: [{ peers: [{ as_path: '13335 15169' }] }] } }),
          }
        }
        if (url.includes('geoloc')) {
          return { ok: true, json: async () => ({ data: { locations: [] } }) }
        }
        throw new Error(`unexpected fetch: ${url}`)
      },
    })

    const response = await handler({
      body: JSON.stringify({ target: 'one.one.one.one' }),
    })

    assert.equal(response.statusCode, 200)
    const payload = JSON.parse(response.body)
    assert.equal(payload.resolvedIP, '1.1.1.1')
    assert.equal(payload.hopCount, 2)
  })
})
