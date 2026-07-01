const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateChannelCreate,
  validateChannelId,
  validateThreadCreate,
  validateThreadId,
  validateCommentCreate,
  validateUserId,
  validateDmSend,
} = require('./validation');

describe('board validation', () => {
  it('validates channel creation input', () => {
    assert.equal(validateChannelCreate({ name: '  General  ' }).ok, true);
    assert.equal(validateChannelCreate({ name: '' }).ok, false);
    assert.equal(validateChannelCreate({ name: 'x'.repeat(200) }).value.name.length, 80);
  });

  it('accepts known channel and thread ids', () => {
    assert.equal(validateChannelId('ch-welcome').ok, true);
    assert.equal(validateThreadId('th-123-abc').ok, true);
  });

  it('rejects malformed ids', () => {
    assert.equal(validateChannelId('../evil').ok, false);
    assert.equal(validateThreadId('thread-1').ok, false);
    assert.equal(validateUserId('bad id').ok, false);
  });

  it('validates thread and comment payloads', () => {
    const thread = validateThreadCreate({
      channelId: 'ch-welcome',
      title: 'Hello',
      body: 'World',
    });
    assert.equal(thread.ok, true);

    const comment = validateCommentCreate({
      threadId: 'th-123-abc',
      body: 'Nice post',
    });
    assert.equal(comment.ok, true);
    assert.equal(validateCommentCreate({ threadId: 'th-1', body: '   ' }).ok, false);
  });

  it('blocks self-directed DMs', () => {
    const ok = validateDmSend({ otherUserId: 'user-b', body: 'hi' }, 'user-a');
    assert.equal(ok.ok, true);
    const self = validateDmSend({ otherUserId: 'user-a', body: 'hi' }, 'user-a');
    assert.equal(self.ok, false);
  });
});

describe('board handler auth', () => {
  it('requires authentication', async () => {
    const { handler } = require('./index');
    const response = await handler({ body: JSON.stringify({ action: 'channels-list' }) });
    assert.equal(response.statusCode, 401);
  });

  it('rejects non-object JSON bodies', async () => {
    const { handler } = require('./index');
    const response = await handler({
      requestContext: { authorizer: { jwt: { claims: { sub: 'user-1', 'cognito:username': 'alice' } } } },
      body: JSON.stringify([]),
    });
    assert.equal(response.statusCode, 400);
  });

  it('rejects unknown actions', async () => {
    const { handler } = require('./index');
    const response = await handler({
      requestContext: { authorizer: { jwt: { claims: { sub: 'user-1', 'cognito:username': 'alice' } } } },
      body: JSON.stringify({ action: 'not-real' }),
    });
    assert.equal(response.statusCode, 400);
  });
});
