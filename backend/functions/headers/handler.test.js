const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  isPrivateIPv4,
  isPrivateIPv6,
  isBlockedIP,
  analyzeSecurityHeaders,
  validateScanUrl,
} = require('./validation')

describe('headers validation', () => {
  it('blocks private IPv4 ranges', () => {
    assert.equal(isPrivateIPv4('127.0.0.1'), true)
    assert.equal(isPrivateIPv4('10.0.0.1'), true)
    assert.equal(isPrivateIPv4('8.8.8.8'), false)
  })

  it('blocks private IPv6 ranges', () => {
    assert.equal(isPrivateIPv6('::1'), true)
    assert.equal(isPrivateIPv6('fe80::1'), true)
    assert.equal(isPrivateIPv6('2001:db8::1'), false)
  })

  it('uses net.isIP for blocked IP checks', () => {
    assert.equal(isBlockedIP('192.168.1.1'), true)
    assert.equal(isBlockedIP('93.184.216.34'), false)
  })

  it('analyzes security headers', () => {
    const headers = new Map([
      ['strict-transport-security', 'max-age=31536000'],
      ['x-frame-options', 'DENY'],
    ])
    const analysis = analyzeSecurityHeaders(headers)
    assert.equal(analysis.present['strict-transport-security'], 'max-age=31536000')
    assert.ok(analysis.missing.includes('content-security-policy'))
  })

  it('validates scan URLs', () => {
    const ok = validateScanUrl('https://example.com')
    assert.ok(ok.parsedUrl)
    assert.equal(validateScanUrl('ftp://example.com').error.statusCode, 400)
    assert.equal(validateScanUrl('https://example.com:8080').error.statusCode, 400)
  })
})

describe('headers handler', () => {
  it('scans a public URL and reports security headers', async () => {
    const { createHandler } = require('./index')
    const handler = createHandler({
      dnsLookup: async () => [{ address: '93.184.216.34', family: 4 }],
      fetch: async () => ({
        status: 200,
        headers: {
          get: (name) => (name === 'strict-transport-security' ? 'max-age=31536000' : null),
          forEach: (cb) => {
            cb('max-age=31536000', 'strict-transport-security')
          },
        },
        body: { cancel: async () => {} },
      }),
    })

    const response = await handler({
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    assert.equal(response.statusCode, 200)
    const payload = JSON.parse(response.body)
    assert.equal(payload.final_url, 'https://example.com/')
    assert.equal(payload.chain[0].security_headers.present['strict-transport-security'], 'max-age=31536000')
  })

  it('blocks private destinations during DNS resolution', async () => {
    const { createHandler } = require('./index')
    const handler = createHandler({
      dnsLookup: async () => [{ address: '127.0.0.1', family: 4 }],
      fetch: async () => {
        throw new Error('fetch should not run for blocked destinations')
      },
    })

    const response = await handler({
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    assert.equal(response.statusCode, 500)
    assert.match(JSON.parse(response.body).details, /Blocked destination/)
  })
})
