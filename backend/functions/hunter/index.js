/**
 * ==============================================================================
 * NETKNIFE - HUNTER.IO EMAIL VERIFICATION LAMBDA
 * ==============================================================================
 * 
 * Email verification and finder using Hunter.io free API.
 * 
 * FEATURES:
 * - Email verification
 * - Email finder
 * - Domain search
 * - Free tier: 25 requests/month
 * 
 * API: https://hunter.io/api-documentation
 * 
 * REQUEST:
 *   POST { "email": "test@example.com" } or { "domain": "example.com" }
 * 
 * RESPONSE:
 *   {
 *     "data": {
 *       "email": "test@example.com",
 *       "result": "deliverable",
 *       "score": 100,
 *       ...
 *     }
 *   }
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "86400"); // 24 hours
const HUNTER_API = "https://api.hunter.io/v2/";
const HUNTER_API_KEY = process.env.HUNTER_API_KEY || ""; // Required

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
// HUNTER API QUERY
// ------------------------------------------------------------------------------

async function queryHunterEmail(email) {
  if (!HUNTER_API_KEY) {
    throw new Error("Hunter.io API key not configured");
  }
  
  const url = `${HUNTER_API}email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NetKnife-EmailVerifier/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Free tier: 25 requests/month.");
      }
      throw new Error(`Hunter.io API error: ${response.status}`);
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

async function queryHunterDomain(domain) {
  if (!HUNTER_API_KEY) {
    throw new Error("Hunter.io API key not configured");
  }
  
  const url = `${HUNTER_API}domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_API_KEY}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NetKnife-DomainSearch/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Free tier: 25 requests/month.");
      }
      throw new Error(`Hunter.io API error: ${response.status}`);
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
    const domain = String(body.domain || "").trim().toLowerCase();
    
    if (!email && !domain) {
      return json(400, { error: "Missing required field: email or domain" });
    }
    
    // Check cache
    const cacheKey = email ? `hunter:email:${email}` : `hunter:domain:${domain}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query Hunter.io API
    let result;
    if (email) {
      if (!isValidEmail(email)) {
        return json(400, { error: "Invalid email format" });
      }
      result = await queryHunterEmail(email);
    } else {
      result = await queryHunterDomain(domain);
    }
    
    if (result.errors) {
      return json(400, { error: result.errors[0]?.details || "Hunter.io API error" });
    }
    
    // Cache result
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("Hunter.io check error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};
