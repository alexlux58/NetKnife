/**
 * Input validation for the guides Lambda.
 */

const MAX_NOTES = 10000;
const MAX_FINDINGS = 50;
const MAX_FINDING_LEN = 2000;
const MAX_COLLABORATORS = 20;
const MAX_FEEDBACK = 2000;
const MAX_USER_CONTEXT = 4000;

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function trimText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function validationError(message) {
  return { ok: false, error: message };
}

function validateGuideId(guideId) {
  const id = trimText(guideId, 64);
  if (!id) return validationError('Missing guideId');
  if (!SAFE_ID.test(id)) return validationError('Invalid guideId');
  return { ok: true, value: id };
}

function validateStepId(stepId) {
  const id = trimText(stepId, 64);
  if (!id) return validationError('Missing stepId');
  if (!SAFE_ID.test(id)) return validationError('Invalid stepId');
  return { ok: true, value: id };
}

function sanitizeStringArray(value, maxItems, maxItemLen) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, maxItemLen));
}

function sanitizeToolResults(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const serialized = JSON.stringify(value);
  if (serialized.length > 50000) return {};
  return value;
}

function validateSaveProgress(body) {
  const guide = validateGuideId(body?.guideId);
  if (!guide.ok) return guide;
  const step = validateStepId(body?.stepId);
  if (!step.ok) return step;

  return {
    ok: true,
    value: {
      guideId: guide.value,
      stepId: step.value,
      completed: !!body.completed,
      notes: trimText(body.notes, MAX_NOTES),
      findings: sanitizeStringArray(body.findings, MAX_FINDINGS, MAX_FINDING_LEN),
      scanResults: sanitizeStringArray(body.scanResults, MAX_FINDINGS, MAX_FINDING_LEN),
      toolResults: sanitizeToolResults(body.toolResults),
      shared: !!body.shared,
      collaborators: sanitizeStringArray(body.collaborators, MAX_COLLABORATORS, 128),
    },
  };
}

function validateGetProgress(body) {
  const guide = validateGuideId(body?.guideId);
  if (!guide.ok) return guide;
  if (body?.stepId == null || body.stepId === '') {
    return { ok: true, value: { guideId: guide.value, stepId: null } };
  }
  const step = validateStepId(body.stepId);
  if (!step.ok) return step;
  return { ok: true, value: { guideId: guide.value, stepId: step.value } };
}

function validateContentRequest(body) {
  const guide = validateGuideId(body?.guideId);
  if (!guide.ok) return guide;
  const step = validateStepId(body?.stepId);
  if (!step.ok) return step;
  const version = trimText(String(body?.version ?? '1'), 16) || '1';
  return { ok: true, value: { guideId: guide.value, stepId: step.value, version } };
}

function validateRating(body) {
  const content = validateContentRequest(body);
  if (!content.ok) return content;
  const rating = Number(body?.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return validationError('Rating must be 1-5');
  }
  return {
    ok: true,
    value: {
      ...content.value,
      rating,
      feedback: trimText(body?.feedback, MAX_FEEDBACK),
    },
  };
}

function validateAIContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return { valid: false, error: 'Content must be an object' };
  }

  const serialized = JSON.stringify(content);
  if (serialized.length > 100000) {
    return { valid: false, error: 'Content exceeds maximum size' };
  }

  if (!content.overview && !content.description) {
    return { valid: false, error: 'Content must have overview or description' };
  }

  return { valid: true };
}

module.exports = {
  SAFE_ID,
  validateGuideId,
  validateStepId,
  validateSaveProgress,
  validateGetProgress,
  validateContentRequest,
  validateRating,
  validateAIContent,
  trimText,
};
