/**
 * ==============================================================================
 * NETKNIFE - USER PROFILE LAMBDA
 * ==============================================================================
 *
 * GET/PUT user profile: theme, avatarUrl, bio, displayName.
 * POST /profile { action: "get" } -> { theme?, avatarUrl?, bio?, displayName? }
 * POST /profile { action: "update", theme?, avatarUrl?, bio?, displayName? } -> profile
 *
 * JWT required. pk = Cognito sub.
 * ==============================================================================
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const PROFILE_TABLE = process.env.PROFILE_TABLE;

const ALLOWED_KEYS = ['theme', 'avatarUrl', 'bio', 'displayName'];

function getUserId(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims
    || event.requestContext?.authorizer?.claims
    || {};
  const sub = claims.sub || claims['cognito:username'];
  if (!sub) {
    const auth = event.headers?.authorization || event.headers?.Authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const payload = JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString());
        return payload.sub || payload['cognito:username'] || null;
      } catch (e) {
        return null;
      }
    }
  }
  return sub || null;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

async function getProfile(userId) {
  if (!PROFILE_TABLE) return {};
  const r = await ddb.send(new GetCommand({
    TableName: PROFILE_TABLE,
    Key: { pk: userId },
  }));
  const item = r.Item || {};
  return {
    theme: item.theme || 'dark',
    avatarUrl: item.avatarUrl || null,
    bio: item.bio || null,
    displayName: item.displayName || null,
  };
}

const DATA_URL_AVATAR = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_AVATAR_DATAURL = 300000;  // ~225KB base64
const MAX_AVATAR_URL = 2048;

function isValidAvatarUrl(v) {
  if (v === null || v === '') return true;
  if (typeof v !== 'string') return false;
  if (DATA_URL_AVATAR.test(v)) return v.length <= MAX_AVATAR_DATAURL;
  if (v.startsWith('http://') || v.startsWith('https://')) return v.length <= MAX_AVATAR_URL;
  return v.length <= MAX_AVATAR_URL;
}

async function updateProfile(userId, patch) {
  const filtered = {};
  for (const k of ALLOWED_KEYS) {
    if (patch[k] !== undefined) {
      if (k === 'theme' && !['light', 'dark', 'system'].includes(patch[k])) continue;
      if (typeof patch[k] === 'string' && k === 'bio' && patch[k].length > 500) continue;
      if (k === 'displayName' && typeof patch[k] === 'string' && patch[k].length > 512) continue;
      if (k === 'avatarUrl' && !isValidAvatarUrl(patch[k])) continue;
      filtered[k] = patch[k] === null || patch[k] === '' ? null : patch[k];
    }
  }
  if (Object.keys(filtered).length === 0) {
    return await getProfile(userId);
  }

  const now = new Date().toISOString();
  const existing = await getProfile(userId);
  const merged = { ...existing, ...filtered, updatedAt: now };

  if (PROFILE_TABLE) {
    await ddb.send(new PutCommand({
      TableName: PROFILE_TABLE,
      Item: {
        pk: userId,
        ...merged,
      },
    }));
  }

  return {
    theme: merged.theme || 'dark',
    avatarUrl: merged.avatarUrl || null,
    bio: merged.bio || null,
    displayName: merged.displayName || null,
  };
}

exports.handler = async (event) => {
  const userId = getUserId(event);
  if (!userId) {
    return json(401, { error: 'Authentication required' });
  }

  let body = {};
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return json(400, { error: 'Invalid JSON body' });
    }
  }

  const action = body.action || 'get';

  if (action === 'get') {
    const profile = await getProfile(userId);
    return json(200, profile);
  }

  if (action === 'update') {
    const profile = await updateProfile(userId, body);
    return json(200, profile);
  }

  return json(400, { error: `Unknown action: ${action}` });
};
