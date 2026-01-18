/**
 * ==============================================================================
 * NETKNIFE - IPQUALITYSCORE EMAIL VERIFICATION LAMBDA
 * ==============================================================================
 * 
 * Email verification and validation using IPQualityScore API.
 * 
 * FEATURES:
 * - Email syntax validation
 * - Domain/MX record validation
 * - Disposable email detection
 * - Spamtrap/honeypot detection
 * - Recent abuse detection
 * - Free tier: 1,000 requests/month
 * 
 * API: https://www.ipqualityscore.com/documentation/email-validation
 * 
 * REQUEST:
 *   POST { "email": "test@example.com" }
 * 
 * RESPONSE:
 *   {
 *     "valid": true,
 *     "disposable": false,
 *     "smtp_score": 0,
 *     "overall_score": 0,
 *     "first_name": "test",
 *     "deliverability": "high",
 *     "catch_all": false,
 *     "common": false,
 *     "dns_valid": true,
 *     "honeypot": false,
 *     "recent_abuse": false,
 *     "spam_trap_score": "none",
 *     ...
 *   }
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600"); // 1 hour
const IPQS_API = "https://ipqualityscore.com/api/json/email/";
const IPQS_API_KEY = process.env.IPQS_API_KEY || ""; // Required

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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ------------------------------------------------------------------------------
// IPQUALITYSCORE EMAIL API QUERY
// ------------------------------------------------------------------------------

async function queryIPQSEmail(email) {
  if (!IPQS_API_KEY) {
    throw new Error("IPQualityScore API key not configured");
  }
  
  // Use fast mode for free tier (skips SMTP check but still validates)
  const url = `${IPQS_API}${IPQS_API_KEY}/${encodeURIComponent(email)}?fast=true&strictness=1`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NetKnife-EmailVerification/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Free tier: 1,000 requests/month.");
      }
      throw new Error(`IPQualityScore API error: ${response.status}`);
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
      return json(400, { error: "Invalid email address format" });
    }
    
    // Check cache
    const cacheKey = `ipqs-email:${email}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query IPQualityScore API
    const result = await queryIPQSEmail(email);
    
    if (!result.success && result.success !== undefined) {
      return json(400, { error: result.message || "Email validation failed" });
    }
    
    // Cache result
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("IPQualityScore email check error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};
