const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { getUsername } = require('./auth')

describe('auth getUsername', () => {
  it('reads cognito:username from ID-token-style claims', () => {
    const event = {
      requestContext: { authorizer: { jwt: { claims: { 'cognito:username': 'alexlux' } } } },
    }
    assert.equal(getUsername(event), 'alexlux')
  })

  it('reads username from access-token-style claims', () => {
    const event = {
      requestContext: { authorizer: { jwt: { claims: { sub: 'abc', username: 'alexlux' } } } },
    }
    assert.equal(getUsername(event), 'alexlux')
  })
})
