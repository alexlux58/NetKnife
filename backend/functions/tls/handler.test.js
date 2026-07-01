const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { validateTlsRequest } = require('./validation')

describe('tls validation', () => {
  it('accepts valid TLS requests', () => {
    const result = validateTlsRequest({ host: 'example.com', port: 443 })
    assert.equal(result.ok, true)
    assert.equal(result.value.port, 443)
  })

  it('rejects invalid ports', () => {
    const result = validateTlsRequest({ host: 'example.com', port: 70000 })
    assert.ok(result.error)
    assert.equal(result.error.statusCode, 400)
  })
})

describe('tls handler', () => {
  it('blocks private destinations before connecting', async () => {
    const { createHandler } = require('./index')
    const handler = createHandler({
      dnsLookup: async () => [{ address: '127.0.0.1', family: 4 }],
      connectTLS: () => {
        throw new Error('connect should not run for blocked destinations')
      },
    })

    const response = await handler({
      body: JSON.stringify({ host: 'example.com', port: 443 }),
    })

    assert.equal(response.statusCode, 400)
    assert.match(JSON.parse(response.body).details, /Blocked destination/)
  })
})
