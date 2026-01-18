/**
 * ==============================================================================
 * NETKNIFE - IPQUALITYSCORE PHONE VALIDATION LAMBDA
 * ==============================================================================
 * 
 * Phone number validation and reputation using IPQualityScore API.
 * 
 * FEATURES:
 * - Phone number format validation
 * - Carrier/line type detection (mobile, landline, VOIP, etc.)
 * - Risky phone detection
 * - Disposable/temporary number detection
 * - Reverse name lookup (where available)
 * - Free tier: 1,000 requests/month
 * 
 * API: https://www.ipqualityscore.com/documentation/phone-number-validation
 * 
 * REQUEST:
 *   POST { "phone": "+1234567890" }
 * 
 * RESPONSE:
 *   {
 *     "valid": true,
 *     "formatted": "+1234567890",
 *     "local_format": "(234) 567-890",
 *     "country_code": "US",
 *     "line_type": "mobile",
 *     "carrier": "Verizon",
 *     "risky": false,
 *     "recent_abuse": false,
 *     "fraud_score": 0,
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
const IPQS_API = "https://ipqualityscore.com/api/json/phone/";
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

function normalizePhone(phone) {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Auto-add +1 for 10-digit US numbers without country code
  const digits = normalized.replace(/\D/g, '');
  if (digits.length === 10 && !normalized.startsWith('+')) {
    normalized = '+1' + digits;
  }
  
  return normalized;
}

function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  // Basic validation: should have at least 10 digits
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

// ------------------------------------------------------------------------------
// IPQUALITYSCORE PHONE API QUERY
// ------------------------------------------------------------------------------

async function queryIPQSPhone(phone) {
  if (!IPQS_API_KEY) {
    throw new Error("IPQualityScore API key not configured");
  }
  
  const normalized = normalizePhone(phone);
  const url = `${IPQS_API}${IPQS_API_KEY}/${encodeURIComponent(normalized)}?strictness=1`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NetKnife-PhoneValidation/1.0",
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
    const phone = String(body.phone || "").trim();
    
    // Validate phone
    if (!phone) {
      return json(400, { error: "Missing required field: phone" });
    }
    
    if (!isValidPhone(phone)) {
      return json(400, { error: "Invalid phone number format" });
    }
    
    // Normalize phone number (auto-add country code if needed)
    const normalized = normalizePhone(phone);
    
    // Check cache
    const cacheKey = `ipqs-phone:${normalized}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query IPQualityScore API (use normalized phone)
    const result = await queryIPQSPhone(normalized);
    
    // IPQualityScore returns success: false for invalid numbers, but that's a valid response
    // Only return error if there's an actual API error message
    if (result.message && (result.message.toLowerCase().includes('api') || result.message.toLowerCase().includes('key'))) {
      return json(400, { error: result.message || "API error" });
    }
    
    // Cache result (even if phone is invalid, cache to avoid repeated API calls)
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    // Return result (success: false is OK - it just means the phone is invalid)
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("IPQualityScore phone check error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};
