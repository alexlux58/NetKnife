const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateGuideId,
  validateStepId,
  validateSaveProgress,
  validateGetProgress,
  validateContentRequest,
  validateRating,
  validateAIContent,
} = require('./validation');

describe('guides validation', () => {
  it('accepts safe guide and step ids', () => {
    assert.equal(validateGuideId('kill-chain').ok, true);
    assert.equal(validateStepId('reconnaissance').ok, true);
  });

  it('rejects unsafe ids', () => {
    assert.equal(validateGuideId('Kill Chain').ok, false);
    assert.equal(validateGuideId('guide#1').ok, false);
    assert.equal(validateStepId('../step').ok, false);
  });

  it('sanitizes saveProgress payloads', () => {
    const result = validateSaveProgress({
      guideId: 'kill-chain',
      stepId: 'reconnaissance',
      completed: true,
      notes: 'done',
      findings: ['a', 'b'],
      collaborators: ['user-1'],
      toolResults: { dns: { ok: true } },
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.completed, true);
    assert.deepEqual(result.value.findings, ['a', 'b']);
  });

  it('limits oversized arrays and notes', () => {
    const result = validateSaveProgress({
      guideId: 'kill-chain',
      stepId: 'reconnaissance',
      notes: 'x'.repeat(20000),
      findings: Array.from({ length: 100 }, (_, i) => `f-${i}`),
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.notes.length, 10000);
    assert.equal(result.value.findings.length, 50);
  });

  it('validates get/content/rating requests', () => {
    assert.equal(validateGetProgress({ guideId: 'kill-chain' }).ok, true);
    assert.equal(validateContentRequest({ guideId: 'kill-chain', stepId: 'reconnaissance' }).ok, true);
    assert.equal(validateRating({ guideId: 'kill-chain', stepId: 'reconnaissance', rating: 4 }).ok, true);
    assert.equal(validateRating({ guideId: 'kill-chain', stepId: 'reconnaissance', rating: 9 }).ok, false);
  });

  it('allows security education terms in AI content', () => {
    const result = validateAIContent({
      overview: 'How to detect exploit attempts and breach patterns.',
      description: 'Offensive security walkthrough',
    });
    assert.equal(result.valid, true);
  });

  it('rejects malformed AI content', () => {
    assert.equal(validateAIContent(null).valid, false);
    assert.equal(validateAIContent({ notes: 'missing overview' }).valid, false);
  });
});

describe('guides handler auth', () => {
  it('requires authentication', async () => {
    process.env.GUIDE_PROGRESS_TABLE = 'guide-progress';
    process.env.GUIDE_CONTENT_TABLE = 'guide-content';
    const { handler } = require('./index');
    const response = await handler({ body: JSON.stringify({ action: 'listProgress' }) });
    assert.equal(response.statusCode, 401);
  });

  it('rejects missing action', async () => {
    process.env.GUIDE_PROGRESS_TABLE = 'guide-progress';
    process.env.GUIDE_CONTENT_TABLE = 'guide-content';
    const { handler } = require('./index');
    const response = await handler({
      requestContext: { authorizer: { jwt: { claims: { sub: 'user-1' } } } },
      body: JSON.stringify({}),
    });
    assert.equal(response.statusCode, 400);
  });
});
