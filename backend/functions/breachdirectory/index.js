/**
 * ==============================================================================
 * NETKNIFE - BREACHDIRECTORY EMAIL BREACH CHECK LAMBDA
 * ==============================================================================
 * 
 * Checks if an email has been compromised in data breaches using BreachDirectory API.
 * Alternative to HIBP for email breach checking.
 * 
 * FEATURES:
 * - Email breach lookup
 * - Free API (no key required)
 * - Lists breach sources
 * 
 * API: https://breachdirectory.tk/
 * 
 * REQUEST:
 *   POST { "email": "test@example.com" }
 * 
 * RESPONSE:
 *   {
 *     "email": "test@example.com",
 *     "found": true,
 *     "breaches": ["LinkedIn", "Adobe", ...],
 *     "count": 2
 *   }
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "86400"); // 24 hours
const BREACHDIRECTORY_API = "https://breachdirectory.tk/api";

// ------------------------------------------------------------------------------
// CACHE HELPERS
// ------------------------------------------------------------------------------

async function cacheGet(key) {
  if (!CACHE_TABLE) return null;
  try {
    const res = await ddb.send(new GetCommand({ TableName: CACHE_TABLE, Key: { cache_key: key } }));
    if (res.Item && res.Item.expires_at > Math.floor(Date.now() / 1000)) {
      return res.Item.data;
    }
  } catch (e) {
    console.warn("Cache get error:", e.message);
  }
  return null;
}

async function cachePut(key, data, ttlSeconds) {
  if (!CACHE_TABLE) return;
  try {
    await ddb.send(new PutCommand({
      TableName: CACHE_TABLE,
      Item: {
        cache_key: key,
        data,
        expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
      },
    }));
  } catch (e) {
    console.warn("Cache put error:", e.message);
  }
}

// ------------------------------------------------------------------------------
// VALIDATION
// ------------------------------------------------------------------------------

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ------------------------------------------------------------------------------
// BREACHDIRECTORY API QUERY
// ------------------------------------------------------------------------------

async function queryBreachDirectory(email) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(`${BREACHDIRECTORY_API}?func=auto&term=${encodeURIComponent(email)}`, {
      headers: {
        "User-Agent": "NetKnife-BreachCheck/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // BreachDirectory.tk is offline - service moved to breachdirectory.com (paid)
      if (response.status === 0 || response.status >= 500) {
        throw new Error('BreachDirectory.tk service is offline. The free API is no longer available. Please use HIBP (Password Breach) tool instead, or upgrade to breachdirectory.com (paid service).');
      }
      throw new Error(`BreachDirectory API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('Request timeout - BreachDirectory.tk service may be offline');
    }
    // If it's a network error, the service is likely offline
    if (e.message.includes('fetch failed') || e.message.includes('ECONNREFUSED') || e.message.includes('ENOTFOUND')) {
      throw new Error('BreachDirectory.tk service is offline. The free API is no longer available. Please use HIBP (Password Breach) tool instead.');
    }
    throw e;
  }
}

// ------------------------------------------------------------------------------
// RESPONSE HELPER
// ------------------------------------------------------------------------------

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

// ------------------------------------------------------------------------------
// LAMBDA HANDLER
// ------------------------------------------------------------------------------

exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const email = String(body.email || "").trim().toLowerCase();
    
    // Validate email
    if (!email) {
      return json(400, { error: "Missing required field: email" });
    }
    
    if (!isValidEmail(email)) {
      return json(400, { error: "Invalid email format" });
    }
    
    // Check cache
    const cacheKey = `breachdir:${email}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query BreachDirectory API
    const apiResult = await queryBreachDirectory(email);
    
    // Parse response
    const result = {
      email,
      found: apiResult.success === true && apiResult.result && apiResult.result.length > 0,
      breaches: [],
      count: 0,
    };
    
    if (result.found && apiResult.result) {
      result.breaches = apiResult.result.map(breach => breach.source || breach.name || "Unknown");
      result.count = result.breaches.length;
    }
    
    // Cache result
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("BreachDirectory check error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};
