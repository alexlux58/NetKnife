/**
 * NETKNIFE - MESSAGE BOARD LAMBDA
 *
 * POST /board { action, ... }
 * - channels-list -> { channels }
 * - channel-create (admin) { name, description } -> { channel }
 * - threads-list { channelId } -> { threads }
 * - thread-create { channelId, title, body, authorName } -> { thread }
 * - thread-get { threadId } -> { thread, comments, likeCount, isLiked, isBookmarked }
 * - comment-add { threadId, body, authorName } -> { comment }
 * - like-toggle { threadId } -> { liked }
 * - bookmark-toggle { threadId } -> { bookmarked }
 * - bookmarks-list -> { threads }
 * - dm-convos -> { convos }
 * - dm-messages { otherUserId } -> { messages }
 * - dm-send { otherUserId, body } -> { message }
 *
 * Admin: only ADMIN_USERNAMES can create channels. Request new: email admin@alexflux.com
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const {
  validateChannelCreate,
  validateChannelId,
  validateThreadCreate,
  validateThreadId,
  validateCommentCreate,
  validateUserId,
  validateDmSend,
  trimText,
} = require('./validation');
const { getUserId, getUsername } = require('netknife-common');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CHANNELS = process.env.BOARD_CHANNELS_TABLE;
const THREADS = process.env.BOARD_THREADS_TABLE;
const COMMENTS = process.env.BOARD_COMMENTS_TABLE;
const LIKES = process.env.BOARD_LIKES_TABLE;
const BOOKMARKS = process.env.BOARD_BOOKMARKS_TABLE;
const DM_CONVOS = process.env.BOARD_DM_CONVOS_TABLE;
const DM_MESSAGES = process.env.BOARD_DM_MESSAGES_TABLE;
const ACTIVITY = process.env.BOARD_ACTIVITY_TABLE;
const ADMIN = (process.env.ADMIN_USERNAMES || 'alex.lux, alexlux, alexlux58, god of lux').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function isAdmin(event) {
  const u = getUsername(event).toLowerCase();
  return u && ADMIN.includes(u);
}

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

async function logActivity(userId, username, action, target, details) {
  if (!ACTIVITY) return;
  try {
    const now = new Date().toISOString();
    const id = Math.random().toString(36).slice(2, 10);
    const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
    await ddb.send(new PutCommand({
      TableName: ACTIVITY,
      Item: { pk: 'ACT', sk: `${now}#${id}`, userId, username: (username || '?').slice(0, 200), action, target: (target || '').slice(0, 256), details: (details || '').slice(0, 500), createdAt: now, ttl },
    }));
  } catch (e) { console.warn('logActivity:', e.message); }
}

function convId(a, b) {
  return [a, b].sort().join('|');
}

const WELCOME_CHANNEL_ID = 'ch-welcome';
const WELCOME_DESCRIPTION = 'Introduce yourself, ask questions, and get to know the community. This is the place for new members and general discussion.';

async function seedWelcomeChannel() {
  if (!CHANNELS) return;
  try {
    await ddb.send(new PutCommand({
      TableName: CHANNELS,
      Item: {
        pk: 'CHAN',
        sk: WELCOME_CHANNEL_ID,
        name: 'Welcome',
        description: WELCOME_DESCRIPTION,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      },
      ConditionExpression: 'attribute_not_exists(sk)',
    }));
  } catch (e) {
    if (e?.name !== 'ConditionalCheckFailedException' && e?.code !== 'ConditionalCheckFailedException') console.warn('seedWelcomeChannel:', e?.message);
  }
}

// --- channels-list
async function channelsList() {
  if (!CHANNELS) return json(200, { channels: [] });
  try {
    await seedWelcomeChannel();
    const r = await ddb.send(new QueryCommand({ TableName: CHANNELS, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': 'CHAN' } }));
    const channels = (r.Items || []).map((i) => ({ id: i.sk, name: i.name, description: i.description || '', createdAt: i.createdAt }));
    return json(200, { channels });
  } catch (e) {
    console.error('channelsList:', e);
    return json(503, { error: 'Board data temporarily unavailable. Check DynamoDB tables and IAM.' });
  }
}

// --- channel-create (admin only)
async function channelCreate(userId, username, body) {
  if (!CHANNELS) return json(503, { error: 'Board not configured.' });
  const validated = validateChannelCreate(body);
  if (!validated.ok) return json(400, { error: validated.error });
  const { name, description } = validated.value;
  const id = `ch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const item = { pk: 'CHAN', sk: id, name, description, createdBy: userId, createdAt: new Date().toISOString() };
  await ddb.send(new PutCommand({ TableName: CHANNELS, Item: item }));
  await logActivity(userId, username, 'channel-create', id, name);
  return json(200, { channel: { id: item.sk, name: item.name, description: item.description, createdAt: item.createdAt } });
}

// --- threads-list
async function threadsList(body) {
  if (!THREADS) return json(200, { threads: [] });
  const validated = validateChannelId(body?.channelId);
  if (!validated.ok) return json(400, { error: validated.error });
  const ch = validated.value;
  const r = await ddb.send(new QueryCommand({
    TableName: THREADS,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': ch },
    ScanIndexForward: false,
    Limit: 100,
  }));
  const threads = (r.Items || []).map((i) => ({ id: i.sk, channelId: i.pk, title: i.title, body: i.body, authorId: i.authorId, authorName: i.authorName || '?', createdAt: i.createdAt }));
  return json(200, { threads });
}

// --- thread-create
async function threadCreate(userId, username, body) {
  if (!THREADS) return json(503, { error: 'Board not configured.' });
  const validated = validateThreadCreate(body);
  if (!validated.ok) return json(400, { error: validated.error });
  const { channelId: ch, title, body: b } = validated.value;
  const authorName = trimText(username, 200) || '?';
  const id = `th-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const item = { pk: ch, sk: id, title, body: b, authorId: userId, authorName, createdAt: now };
  await ddb.send(new PutCommand({ TableName: THREADS, Item: item }));
  await logActivity(userId, username, 'thread-create', ch, title);
  return json(200, { thread: { id: item.sk, channelId: item.pk, title: item.title, body: item.body, authorId: item.authorId, authorName: item.authorName, createdAt: item.createdAt } });
}

// --- thread-get
async function threadGet(userId, body) {
  const threadValidated = validateThreadId(body?.threadId);
  if (!threadValidated.ok) return json(400, { error: threadValidated.error });
  const threadId = threadValidated.value;
  const channelValidated = validateChannelId(body?.channelId);
  if (!channelValidated.ok) return json(400, { error: channelValidated.error });
  const ch = channelValidated.value;
  const tr = await ddb.send(new GetCommand({ TableName: THREADS, Key: { pk: ch, sk: threadId } }));
  const t = tr.Item;
  if (!t) return json(404, { error: 'Thread not found.' });
  const thread = { id: t.sk, channelId: t.pk, title: t.title, body: t.body, authorId: t.authorId, authorName: t.authorName || '?', createdAt: t.createdAt };
  const cr = await ddb.send(new QueryCommand({ TableName: COMMENTS, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': threadId } }));
  const comments = (cr.Items || []).map((i) => ({ id: i.sk, threadId: i.pk, body: i.body, authorId: i.authorId, authorName: i.authorName || '?', createdAt: i.createdAt }));
  let likeCount = 0;
  let isLiked = false;
  let isBookmarked = false;
  if (LIKES) {
    const lr = await ddb.send(new QueryCommand({ TableName: LIKES, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': threadId } }));
    likeCount = (lr.Items || []).length;
    isLiked = (lr.Items || []).some((i) => i.sk === `LIKE#${userId}`);
  }
  if (BOOKMARKS && userId) {
    const br = await ddb.send(new GetCommand({ TableName: BOOKMARKS, Key: { pk: userId, sk: threadId } }));
    isBookmarked = !!br.Item;
  }
  return json(200, { thread, comments, likeCount, isLiked, isBookmarked });
}

// --- comment-add
async function commentAdd(userId, username, body) {
  if (!COMMENTS) return json(503, { error: 'Board not configured.' });
  const validated = validateCommentCreate(body);
  if (!validated.ok) return json(400, { error: validated.error });
  const { threadId, body: b } = validated.value;
  const authorName = trimText(username, 200) || '?';
  const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const item = { pk: threadId, sk: id, body: b, authorId: userId, authorName, createdAt: now };
  await ddb.send(new PutCommand({ TableName: COMMENTS, Item: item }));
  await logActivity(userId, username, 'comment-add', threadId, b.slice(0, 80));
  return json(200, { comment: { id: item.sk, threadId: item.pk, body: item.body, authorId: item.authorId, authorName: item.authorName, createdAt: item.createdAt } });
}

// --- like-toggle
async function likeToggle(userId, body) {
  if (!LIKES) return json(503, { error: 'Board not configured.' });
  const validated = validateThreadId(body?.threadId);
  if (!validated.ok) return json(400, { error: validated.error });
  const threadId = validated.value;
  const key = { pk: threadId, sk: `LIKE#${userId}` };
  const r = await ddb.send(new GetCommand({ TableName: LIKES, Key: key }));
  let liked;
  if (r.Item) {
    await ddb.send(new DeleteCommand({ TableName: LIKES, Key: key }));
    liked = false;
  } else {
    await ddb.send(new PutCommand({ TableName: LIKES, Item: { ...key, createdAt: new Date().toISOString() } }));
    liked = true;
  }
  return json(200, { liked });
}

// --- bookmark-toggle (body.channelId stored for bookmarks-list)
async function bookmarkToggle(userId, body) {
  if (!BOOKMARKS) return json(503, { error: 'Board not configured.' });
  const validated = validateThreadId(body?.threadId);
  if (!validated.ok) return json(400, { error: validated.error });
  const threadId = validated.value;
  let channelId = null;
  if (body?.channelId) {
    const channelValidated = validateChannelId(body.channelId);
    if (!channelValidated.ok) return json(400, { error: channelValidated.error });
    channelId = channelValidated.value;
  }
  const key = { pk: userId, sk: threadId };
  const r = await ddb.send(new GetCommand({ TableName: BOOKMARKS, Key: key }));
  let bookmarked;
  const now = new Date().toISOString();
  if (r.Item) {
    await ddb.send(new DeleteCommand({ TableName: BOOKMARKS, Key: key }));
    bookmarked = false;
  } else {
    await ddb.send(new PutCommand({ TableName: BOOKMARKS, Item: { ...key, channelId: channelId || null, createdAt: now } }));
    bookmarked = true;
  }
  return json(200, { bookmarked });
}

// --- bookmarks-list
async function bookmarksList(userId) {
  if (!BOOKMARKS || !THREADS) return json(200, { threads: [] });
  try {
    const r = await ddb.send(new QueryCommand({ TableName: BOOKMARKS, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': userId } }));
    const threads = [];
    for (const b of r.Items || []) {
      const ch = b.channelId;
      if (!ch) continue;
      const tr = await ddb.send(new GetCommand({ TableName: THREADS, Key: { pk: ch, sk: b.sk } }));
      if (tr.Item) threads.push({ id: tr.Item.sk, channelId: tr.Item.pk, title: tr.Item.title, authorName: tr.Item.authorName, createdAt: tr.Item.createdAt });
    }
    threads.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return json(200, { threads });
  } catch (e) {
    console.error('bookmarksList:', e);
    return json(503, { error: 'Board data temporarily unavailable. Check DynamoDB tables and IAM.' });
  }
}

// --- dm-convos
async function dmConvos(userId) {
  if (!DM_CONVOS) return json(200, { convos: [] });
  try {
    const r = await ddb.send(new QueryCommand({ TableName: DM_CONVOS, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': userId } }));
    const convos = (r.Items || []).map((i) => {
      const preview = (i.lastPreview || '').slice(0, 100);
      return { otherUserId: i.sk, lastAt: i.lastAt, lastPreview: preview, outbound: preview.startsWith('You: ') };
    }).sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
    return json(200, { convos });
  } catch (e) {
    console.error('dmConvos:', e);
    return json(503, { error: 'Board data temporarily unavailable. Check DynamoDB tables and IAM.' });
  }
}

// --- dm-messages
async function dmMessages(userId, body) {
  if (!DM_MESSAGES) return json(200, { messages: [] });
  const validated = validateUserId(body?.otherUserId);
  if (!validated.ok) return json(400, { error: validated.error });
  const other = validated.value;
  const cid = convId(userId, other);
  const r = await ddb.send(new QueryCommand({
    TableName: DM_MESSAGES,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': cid },
    ScanIndexForward: true,
    Limit: 100,
  }));
  const messages = (r.Items || []).map((i) => ({ id: i.sk, fromUserId: i.fromUserId, fromName: i.fromName, body: i.body, createdAt: i.createdAt }));
  return json(200, { messages });
}

// --- dm-send
async function dmSend(userId, username, body) {
  if (!DM_MESSAGES || !DM_CONVOS) return json(503, { error: 'DMs not configured.' });
  const validated = validateDmSend(body, userId);
  if (!validated.ok) return json(400, { error: validated.error });
  const { otherUserId: other, body: b } = validated.value;
  const fromName = trimText(username, 200) || '?';
  const cid = convId(userId, other);
  const now = new Date().toISOString();
  const msgId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const preview = b.slice(0, 80);
  await ddb.send(new PutCommand({
    TableName: DM_MESSAGES,
    Item: { pk: cid, sk: `${now}#${msgId}`, fromUserId: userId, fromName, body: b.slice(0, 4000), createdAt: now },
  }));
  for (const u of [userId, other]) {
    const o = u === userId ? other : userId;
    await ddb.send(new PutCommand({
      TableName: DM_CONVOS,
      Item: { pk: u, sk: o, lastAt: now, lastPreview: u === userId ? `You: ${preview}` : preview, updatedAt: now },
    }));
  }
  await logActivity(userId, username, 'dm-send', other, preview);
  return json(200, { message: { id: msgId, fromUserId: userId, fromName, body: b, createdAt: now } });
}

// --- activity-list (admin only): recent board actions for dashboard
async function activityList() {
  if (!ACTIVITY) return json(200, { items: [] });
  try {
    const r = await ddb.send(new QueryCommand({
      TableName: ACTIVITY,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': 'ACT' },
      ScanIndexForward: false,
      Limit: 100,
    }));
    const items = (r.Items || [])
      .filter((i) => i != null)
      .map((i) => ({
        action: i?.action ?? '',
        userId: i?.userId ?? '',
        username: i?.username ?? '',
        target: i?.target ?? '',
        details: i?.details ?? '',
        createdAt: i?.createdAt ?? '',
      }));
    return json(200, { items });
  } catch (e) {
    console.error('activityList:', e?.message || e);
    // Table missing or no permission: return empty so admin sees "No activity yet" instead of 5xx
    const code = e?.name || e?.code || '';
    if (code === 'ResourceNotFoundException' || code === 'AccessDeniedException') {
      return json(200, { items: [] });
    }
    return json(503, { error: 'Activity log temporarily unavailable.' });
  }
}

exports.handler = async (event) => {
  try {
    const userId = getUserId(event);
    if (!userId) return json(401, { error: 'Authentication required' });

    let body = {};
    if (event.body) {
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (e) {
        return json(400, { error: 'Invalid JSON' });
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json(400, { error: 'Request body must be a JSON object' });
    }

    const action = (body.action || '').trim();

    const username = getUsername(event);
    switch (action) {
      case 'channels-list': return channelsList();
      case 'channel-create': return isAdmin(event) ? channelCreate(userId, username, body) : json(403, { error: 'Only admins can create channels. Email admin@alexflux.com to request one.' });
      case 'threads-list': return threadsList(body);
      case 'thread-create': return threadCreate(userId, username, body);
      case 'thread-get': return threadGet(userId, body);
      case 'comment-add': return commentAdd(userId, username, body);
      case 'like-toggle': return likeToggle(userId, body);
      case 'bookmark-toggle': return bookmarkToggle(userId, body);
      case 'bookmarks-list': return bookmarksList(userId);
      case 'dm-convos': return dmConvos(userId);
      case 'dm-messages': return dmMessages(userId, body);
      case 'dm-send': return dmSend(userId, username, body);
      case 'activity-list': {
        if (!isAdmin(event)) return json(403, { error: 'Only admins can view the activity dashboard.' });
        try {
          return await activityList();
        } catch (e) {
          console.error('activity-list handler:', e?.message || e);
          return json(200, { items: [] });
        }
      }
      default: return json(400, { error: `Unknown action: ${action || '(missing)'}` });
    }
  } catch (err) {
    console.error('Board Lambda error:', err);
    return json(500, { error: 'Internal server error' });
  }
};
