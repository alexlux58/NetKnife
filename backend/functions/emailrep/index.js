/**
 * ==============================================================================
 * NETKNIFE - EMAILREP.IO EMAIL REPUTATION LAMBDA
 * ==============================================================================
 * 
 * Checks email reputation using EmailRep.io free API.
 * 
 * FEATURES:
 * - Email reputation scoring
 * - Suspicious activity detection
 * - Domain reputation
 * - Free tier: 10,000 queries/month
 * 
 * API: https://emailrep.io/
 * 
 * REQUEST:
 *   POST { "email": "test@example.com" }
 * 
 * RESPONSE:
 *   {
 *     "email": "test@example.com",
 *     "reputation": "high",
 *     "suspicious": false,
 *     "details": { ... }
 *   }
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600"); // 1 hour
const EMAILREP_API = "https://emailrep.io/";
const EMAILREP_API_KEY = process.env.EMAILREP_API_KEY; // Optional, increases rate limits

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
// EMAILREP API QUERY
// ------------------------------------------------------------------------------

async function queryEmailRep(email) {
  const url = `${EMAILREP_API}${encodeURIComponent(email)}`;
  const headers = {
    "User-Agent": "NetKnife-EmailRep/1.0",
  };
  
  // Add API key if available (increases rate limits)
  if (EMAILREP_API_KEY) {
    headers["Key"] = EMAILREP_API_KEY;
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      throw new Error(`EmailRep API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('Request timeout');
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
    const cacheKey = `emailrep:${email}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query EmailRep API
    const result = await queryEmailRep(email);
    
    // Cache result
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("EmailRep check error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};
