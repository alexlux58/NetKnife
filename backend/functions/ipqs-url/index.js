/**
 * ==============================================================================
 * NETKNIFE - IPQUALITYSCORE URL SCANNER LAMBDA
 * ==============================================================================
 * 
 * Malicious URL scanner and reputation using IPQualityScore API.
 * 
 * FEATURES:
 * - URL reputation scoring
 * - Phishing detection
 * - Malware detection
 * - Suspicious content detection
 * - Redirect chain analysis
 * - Free tier: 1,000 requests/month
 * 
 * API: https://www.ipqualityscore.com/documentation/malicious-url-scanner
 * 
 * REQUEST:
 *   POST { "url": "https://example.com" }
 * 
 * RESPONSE:
 *   {
 *     "unsafe": false,
 *     "domain": "example.com",
 *     "ip_address": "93.184.216.34",
 *     "country_code": "US",
 *     "server": "nginx",
 *     "content_type": "text/html",
 *     "status_code": 200,
 *     "page_size": 1256,
 *     "domain_rank": 1,
 *     "dns_valid": true,
 *     "suspicious": false,
 *     "phishing": false,
 *     "malware": false,
 *     "spamming": false,
 *     "parking": false,
 *     "malicious": false,
 *     "risk_score": 0,
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
const IPQS_API = "https://ipqualityscore.com/api/json/url/";
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

function isValidURL(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function normalizeURL(url) {
  let u = url;
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = `https://${u}`;
  }
  // Ensure a path; some APIs handle "https://example.com/" better than "https://example.com"
  try {
    const p = new URL(u);
    if (p.pathname === '') {
      u = u.replace(/^(https?:\/\/[^/?#]+)(\?.*)?$/, (_, base, q) => base + '/' + (q || ''));
    }
  } catch (_) {}
  return u;
}

// ------------------------------------------------------------------------------
// IPQUALITYSCORE URL API QUERY
// ------------------------------------------------------------------------------

async function queryIPQSUrl(url) {
  if (!IPQS_API_KEY) {
    throw new Error("IPQualityScore API key not configured");
  }
  
  const normalized = normalizeURL(url);
  // Use fast mode for free tier (lighter scan)
  const urlEncoded = encodeURIComponent(normalized);
  const apiUrl = `${IPQS_API}${IPQS_API_KEY}/${urlEncoded}?strictness=1&fast=true`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // URL scans can take longer
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "NetKnife-URLScanner/1.0",
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
    const url = String(body.url || "").trim();
    
    // Validate URL
    if (!url) {
      return json(400, { error: "Missing required field: url" });
    }
    
    const normalized = normalizeURL(url);
    if (!isValidURL(normalized)) {
      return json(400, { error: "Invalid URL format" });
    }
    
    // Check cache
    const cacheKey = `ipqs-url:${normalized}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query IPQualityScore API
    const result = await queryIPQSUrl(url);
    
    if (!result.success && result.success !== undefined) {
      return json(400, { error: result.message || "URL scan failed" });
    }
    
    // Cache result
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("IPQualityScore URL scan error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};
