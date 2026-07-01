const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  isBlockedIP,
  validateHostname,
  resolveAndValidateHost,
  validateTlsPort,
  validateRdapQuery,
  isAllowedRdapHost,
  validateTracerouteTarget,
} = require('./ssrf')

describe('shared ssrf validation', () => {
  it('blocks private and reserved IPs', () => {
    assert.equal(isBlockedIP('127.0.0.1'), true)
    assert.equal(isBlockedIP('10.0.0.1'), true)
    assert.equal(isBlockedIP('::1'), true)
    assert.equal(isBlockedIP('8.8.8.8'), false)
  })

  it('validates hostnames and literal IPs', () => {
    assert.equal(validateHostname('example.com').ok, true)
    assert.equal(validateHostname('127.0.0.1').ok, false)
    assert.equal(validateHostname('bad_host').ok, false)
  })

  it('resolves DNS and blocks private destinations', async () => {
    const ok = await resolveAndValidateHost('example.com', async () => [{ address: '93.184.216.34', family: 4 }])
    assert.equal(ok.ok, true)

    const blocked = await resolveAndValidateHost('example.com', async () => [{ address: '127.0.0.1', family: 4 }])
    assert.equal(blocked.ok, false)
  })

  it('validates TLS ports', () => {
    assert.equal(validateTlsPort(443).ok, true)
    assert.equal(validateTlsPort(0).ok, false)
    assert.equal(validateTlsPort(70000).ok, false)
  })

  it('validates RDAP queries and hosts', () => {
    assert.equal(validateRdapQuery('8.8.8.8').ok, true)
    assert.equal(validateRdapQuery('example.com').ok, true)
    assert.equal(validateRdapQuery('127.0.0.1').ok, false)
    assert.equal(validateRdapQuery('not valid').ok, false)
    assert.equal(isAllowedRdapHost('rdap.org'), true)
    assert.equal(isAllowedRdapHost('evil.example'), false)
  })

  it('validates traceroute targets', () => {
    assert.equal(validateTracerouteTarget('1.1.1.1').ok, true)
    assert.equal(validateTracerouteTarget('cloudflare.com').ok, true)
    assert.equal(validateTracerouteTarget('192.168.1.1').ok, false)
    assert.equal(validateTracerouteTarget('bad host').ok, false)
  })
})
