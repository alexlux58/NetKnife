/**
 * Input validation for the message board Lambda.
 */

const MAX_CHANNEL_NAME = 80;
const MAX_CHANNEL_DESC = 500;
const MAX_TITLE = 200;
const MAX_THREAD_BODY = 10000;
const MAX_COMMENT_BODY = 5000;
const MAX_DM_BODY = 4000;
const MAX_DISPLAY_NAME = 200;

// Channel/thread/comment ids generated server-side; client-supplied ids must match safe patterns.
const CHANNEL_ID = /^ch-[a-zA-Z0-9_-]{1,128}$/;
const THREAD_ID = /^th-[a-zA-Z0-9_-]{1,128}$/;
const USER_ID = /^[a-zA-Z0-9_-]{1,128}$/;

function trimText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function validationError(message) {
  return { ok: false, error: message };
}

function validateChannelId(channelId) {
  const id = trimText(channelId, 140);
  if (!id) return validationError('channelId is required.');
  if (!CHANNEL_ID.test(id)) return validationError('Invalid channelId.');
  return { ok: true, value: id };
}

function validateThreadId(threadId) {
  const id = trimText(threadId, 140);
  if (!id) return validationError('threadId is required.');
  if (!THREAD_ID.test(id)) return validationError('Invalid threadId.');
  return { ok: true, value: id };
}

function validateUserId(userId) {
  const id = trimText(userId, 128);
  if (!id) return validationError('otherUserId is required.');
  if (!USER_ID.test(id)) return validationError('Invalid otherUserId.');
  return { ok: true, value: id };
}

function validateChannelCreate(body) {
  const name = trimText(body?.name, MAX_CHANNEL_NAME);
  if (!name) return validationError('Channel name is required.');
  return {
    ok: true,
    value: {
      name,
      description: trimText(body?.description, MAX_CHANNEL_DESC),
    },
  };
}

function validateThreadCreate(body) {
  const channel = validateChannelId(body?.channelId);
  if (!channel.ok) return channel;
  const title = trimText(body?.title, MAX_TITLE);
  if (!title) return validationError('channelId and title are required.');
  return {
    ok: true,
    value: {
      channelId: channel.value,
      title,
      body: trimText(body?.body, MAX_THREAD_BODY),
    },
  };
}

function validateCommentCreate(body) {
  const thread = validateThreadId(body?.threadId);
  if (!thread.ok) return thread;
  const text = trimText(body?.body, MAX_COMMENT_BODY);
  if (!text) return validationError('threadId and body are required.');
  return { ok: true, value: { threadId: thread.value, body: text } };
}

function validateDmSend(body, senderUserId) {
  const recipient = validateUserId(body?.otherUserId);
  if (!recipient.ok) return recipient;
  if (recipient.value === senderUserId) {
    return validationError('Cannot send a direct message to yourself.');
  }
  const text = trimText(body?.body, MAX_DM_BODY);
  if (!text) return validationError('otherUserId and body are required.');
  return { ok: true, value: { otherUserId: recipient.value, body: text } };
}

function resolveAuthorName(event, getUsername) {
  const username = trimText(getUsername(event), MAX_DISPLAY_NAME);
  return username || '?';
}

module.exports = {
  MAX_CHANNEL_NAME,
  MAX_THREAD_BODY,
  CHANNEL_ID,
  THREAD_ID,
  USER_ID,
  trimText,
  validateChannelId,
  validateThreadId,
  validateUserId,
  validateChannelCreate,
  validateThreadCreate,
  validateCommentCreate,
  validateDmSend,
  resolveAuthorName,
};
