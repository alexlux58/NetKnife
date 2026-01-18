/**
 * ==============================================================================
 * NETKNIFE - PHONE NUMBER VALIDATOR LAMBDA
 * ==============================================================================
 * 
 * Validates phone numbers using NumLookup free API.
 * 
 * FEATURES:
 * - Phone number validation
 * - Carrier detection
 * - Line type detection
 * - Country information
 * - Free tier available
 * 
 * API: https://numlookupapi.com/
 * 
 * REQUEST:
 *   POST { "phone": "+1234567890" }
 * 
 * RESPONSE:
 *   {
 *     "valid": true,
 *     "number": "+1234567890",
 *     "country": "United States",
 *     "carrier": "Verizon",
 *     "line_type": "mobile",
 *     ...
 *   }
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "86400"); // 24 hours
const NUMLOOKUP_API = "https://api.numlookupapi.com/v1/validate/";
const NUMLOOKUP_API_KEY = process.env.NUMLOOKUP_API_KEY; // Optional, increases rate limits

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

function normalizePhone(phone) {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // If it's a 10-digit US number without country code, add +1
  const digits = normalized.replace(/\D/g, '');
  if (digits.length === 10 && !normalized.startsWith('+') && !normalized.startsWith('1')) {
    normalized = '+1' + digits;
  }
  
  return normalized;
}

// ------------------------------------------------------------------------------
// NUMLOOKUP API QUERY
// ------------------------------------------------------------------------------

async function queryNumLookup(phone) {
  const url = `${NUMLOOKUP_API}${encodeURIComponent(phone)}`;
  const headers = {
    "User-Agent": "NetKnife-PhoneValidator/1.0",
  };
  
  if (NUMLOOKUP_API_KEY) {
    headers["apikey"] = NUMLOOKUP_API_KEY;
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
      throw new Error(`NumLookup API error: ${response.status}`);
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
    const phone = normalizePhone(String(body.phone || "").trim());
    
    // Validate phone
    if (!phone) {
      return json(400, { error: "Missing required field: phone" });
    }
    
    if (phone.length < 7) {
      return json(400, { error: "Invalid phone number format" });
    }
    
    // Check cache
    const cacheKey = `phone:${phone}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query NumLookup API
    const result = await queryNumLookup(phone);
    
    // Cache result
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("Phone validation error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};
