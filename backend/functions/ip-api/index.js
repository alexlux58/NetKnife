/**
 * ==============================================================================
 * NETKNIFE - IP-API.COM IP GEOLOCATION LAMBDA
 * ==============================================================================
 * 
 * IP geolocation and information using ip-api.com free API.
 * 
 * FEATURES:
 * - IP geolocation (city, country, coordinates)
 * - ISP and organization info
 * - ASN information
 * - Timezone
 * - Free tier: 45 requests/minute (no API key needed)
 * 
 * API: http://ip-api.com/
 * 
 * REQUEST:
 *   POST { "ip": "8.8.8.8" }
 * 
 * RESPONSE:
 *   {
 *     "status": "success",
 *     "country": "United States",
 *     "city": "Mountain View",
 *     "lat": 37.4056,
 *     "lon": -122.0775,
 *     "isp": "Google LLC",
 *     "org": "Google Public DNS",
 *     "as": "AS15169 Google LLC",
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
const IP_API_URL = "http://ip-api.com/json/";

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
  // Basic IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every(p => p >= 0 && p <= 255);
  }
  
  // Basic IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
}

// ------------------------------------------------------------------------------
// IP-API QUERY
// ------------------------------------------------------------------------------

async function queryIPAPI(ip) {
  const url = `${IP_API_URL}${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,query`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NetKnife-IPGeolocation/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`IP-API error: ${response.status}`);
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
    const cacheKey = `ipapi:${ip}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query IP-API
    const result = await queryIPAPI(ip);
    
    if (result.status === "fail") {
      return json(400, { error: result.message || "IP lookup failed" });
    }
    
    // Cache result
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("IP-API check error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};
