/**
 * ==============================================================================
 * NETKNIFE - IPQUALITYSCORE IP REPUTATION LAMBDA
 * ==============================================================================
 * 
 * IP reputation and fraud detection using IPQualityScore free API.
 * 
 * FEATURES:
 * - IP reputation scoring
 * - VPN/Proxy/Tor detection
 * - Fraud score
 * - Bot detection
 * - Free tier: 100 requests/day
 * 
 * API: https://www.ipqualityscore.com/
 * 
 * REQUEST:
 *   POST { "ip": "8.8.8.8" }
 * 
 * RESPONSE:
 *   {
 *     "success": true,
 *     "fraud_score": 0,
 *     "country_code": "US",
 *     "region": "California",
 *     "city": "Mountain View",
 *     "ISP": "Google",
 *     "vpn": false,
 *     "proxy": false,
 *     "tor": false,
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
const IPQS_API = "https://ipqualityscore.com/api/json/ip/";
const IPQS_API_KEY = process.env.IPQS_API_KEY || ""; // Required for free tier

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

function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every(p => p >= 0 && p <= 255);
  }
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
}

// ------------------------------------------------------------------------------
// IPQUALITYSCORE API QUERY
// ------------------------------------------------------------------------------

async function queryIPQualityScore(ip) {
  if (!IPQS_API_KEY) {
    throw new Error("IPQualityScore API key not configured");
  }
  
  const url = `${IPQS_API}${IPQS_API_KEY}/${encodeURIComponent(ip)}?strictness=1&fast=true`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NetKnife-IPReputation/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Free tier: 100 requests/day.");
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
    const ip = String(body.ip || "").trim();
    
    // Validate IP
    if (!ip) {
      return json(400, { error: "Missing required field: ip" });
    }
    
    if (!isValidIP(ip)) {
      return json(400, { error: "Invalid IP address format" });
    }
    
    // Check cache
    const cacheKey = `ipqs:${ip}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query IPQualityScore API
    const result = await queryIPQualityScore(ip);
    
    if (!result.success) {
      return json(400, { error: result.message || "IP lookup failed" });
    }
    
    // Cache result
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("IPQualityScore check error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};
