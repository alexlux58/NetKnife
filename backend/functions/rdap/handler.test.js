const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { validateRdapQuery, isAllowedRdapHost, buildRdapUrl } = require('./validation')

describe('rdap validation', () => {
  it('accepts public IPs and domains', () => {
    assert.equal(validateRdapQuery('8.8.8.8').ok, true)
    assert.equal(validateRdapQuery('example.com').ok, true)
  })

  it('rejects private IPs and malformed queries', () => {
    assert.equal(validateRdapQuery('127.0.0.1').ok, false)
    assert.equal(validateRdapQuery('not valid').ok, false)
  })

  it('enforces RDAP host allowlist', () => {
    assert.equal(isAllowedRdapHost('rdap.org'), true)
    assert.equal(isAllowedRdapHost('evil.example'), false)
  })

  it('builds bootstrap URLs', () => {
    assert.match(buildRdapUrl('8.8.8.8', 'ip'), /\/ip\/8\.8\.8\.8$/)
    assert.match(buildRdapUrl('example.com', 'domain'), /\/domain\/example\.com$/)
  })
})

describe('rdap handler', () => {
  it('rejects disallowed redirect hosts', async () => {
    const { createHandler } = require('./index')
    const handler = createHandler({
      cacheTable: null,
      fetch: async () => ({
        status: 302,
        headers: { get: () => 'https://evil.example/ip/8.8.8.8' },
        text: async () => '',
      }),
    })

    const response = await handler({
      body: JSON.stringify({ query: '8.8.8.8' }),
    })

    assert.equal(response.statusCode, 500)
    assert.match(JSON.parse(response.body).details, /Disallowed RDAP host/)
  })

  it('returns RDAP data for allowed hosts', async () => {
    const { createHandler } = require('./index')
    const handler = createHandler({
      cacheTable: null,
      fetch: async () => ({
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ name: 'EXAMPLE' }),
      }),
    })

    const response = await handler({
      body: JSON.stringify({ query: 'example.com' }),
    })

    assert.equal(response.statusCode, 200)
    const payload = JSON.parse(response.body)
    assert.equal(payload.query, 'example.com')
    assert.equal(payload.data.name, 'EXAMPLE')
  })
})
