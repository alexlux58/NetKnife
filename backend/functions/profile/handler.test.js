const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('profile handler auth and validation', () => {
  it('requires authentication', async () => {
    const { handler } = require('./index');
    const response = await handler({ body: JSON.stringify({ action: 'get' }) });
    assert.equal(response.statusCode, 401);
  });

  it('rejects invalid avatar URLs on update', async () => {
    const { handler } = require('./index');
    const response = await handler({
      requestContext: { authorizer: { jwt: { claims: { sub: 'user-1' } } } },
      body: JSON.stringify({
        action: 'update',
        avatarUrl: 'javascript:alert(1)',
      }),
    });
    assert.equal(response.statusCode, 400);
  });

  it('accepts data URL avatars within size limits', async () => {
    const { handler } = require('./index');
    const tinyPng = 'data:image/png;base64,iVBORw0KGgo=';
    const response = await handler({
      requestContext: { authorizer: { jwt: { claims: { sub: 'user-1' } } } },
      body: JSON.stringify({
        action: 'update',
        avatarUrl: tinyPng,
      }),
    });
    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.avatarUrl, tinyPng);
  });
});
