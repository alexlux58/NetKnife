const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('cognito-triggers PreSignUp_ExternalProvider', () => {
  it('auto-confirms federated sign-up', async () => {
    delete process.env.CONFIG_TABLE_NAME;
    const { handler } = require('./index');
    const event = {
      triggerSource: 'PreSignUp_ExternalProvider',
      userName: 'Google_123',
      request: {
        userAttributes: {
          email: 'user@gmail.com',
          sub: 'abc-123',
        },
      },
      response: {},
    };
    const out = await handler(event);
    assert.equal(out.response.autoConfirmUser, true);
    assert.equal(out.response.autoVerifyEmail, true);
  });
});
