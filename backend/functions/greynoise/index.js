/**
 * ==============================================================================
 * NETKNIFE - GREYNOISE LAMBDA
 * ==============================================================================
 *
 * Queries GreyNoise API for internet scanner and noise detection.
 *
 * FEATURES:
 * - IP classification (benign, malicious, unknown)
 * - Scanner/noise detection
 * - Bot detection
 * - Activity metadata
 *
 * REQUIRES: GREYNOISE_API_KEY environment variable
 *
 * REQUEST:
 *   POST { "ip": "8.8.8.8" }
 *
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600"); // 1 hour
const GREYNOISE_API_KEY = process.env.GREYNOISE_API_KEY;

// Community API (free) vs Enterprise API
const GREYNOISE_API_BASE = "https://api.greynoise.io/v3/community";

/**
 * Standard JSON response helper
 */
function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

/**
 * Cache helpers
 */
async function cacheGet(key) {
  if (!CACHE_TABLE) return null;
  try {
    const result = await ddb.send(new GetCommand({
      TableName: CACHE_TABLE,
      Key: { cache_key: key },
    }));
    if (result.Item && result.Item.expires_at > Math.floor(Date.now() / 1000)) {
      return result.Item.data;
    }
  } catch (e) {
    console.error("Cache get error:", e);
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
    console.error("Cache put error:", e);
  }
}

/**
 * Validate IP address
 */
function isValidIP(ip) {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

/**
 * Check if IP is private
 */
function isPrivateIP(ip) {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
  ];
  return privateRanges.some(r => r.test(ip));
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  if (!GREYNOISE_API_KEY) {
    return json(501, { error: "GreyNoise integration not configured. API key required." });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return json(400, { error: "Invalid JSON body" });
  }

  const { ip } = body;

  if (!ip || !isValidIP(ip)) {
    return json(400, { error: "Invalid IP address. Only IPv4 is supported." });
  }

  if (isPrivateIP(ip)) {
    return json(400, { error: "Cannot query private IP addresses" });
  }

  // Check cache
  const cacheKey = `greynoise-${ip}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  try {
    const response = await fetch(`${GREYNOISE_API_BASE}/${ip}`, {
      headers: {
        "key": GREYNOISE_API_KEY,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // IP not seen by GreyNoise - this is actually useful info
        const result = {
          ip,
          noise: false,
          riot: false,
          classification: "unknown",
          message: "IP has not been observed by GreyNoise scanners",
          queriedAt: new Date().toISOString(),
        };
        await cachePut(cacheKey, result, TTL_SECONDS);
        return json(200, { ...result, cached: false });
      }
      if (response.status === 401) {
        return json(401, { error: "Invalid GreyNoise API key" });
      }
      if (response.status === 429) {
        return json(429, { error: "GreyNoise rate limit exceeded" });
      }
      return json(response.status, { error: `GreyNoise API error: ${response.statusText}` });
    }

    const data = await response.json();

    const result = {
      ip,
      
      // Is this IP generating internet noise?
      noise: data.noise || false,
      
      // Is this IP part of a known benign service (RIOT)?
      riot: data.riot || false,
      
      // Classification: benign, malicious, or unknown
      classification: data.classification || "unknown",
      
      // Human-readable name (if known)
      name: data.name,
      
      // Link to GreyNoise visualizer
      link: data.link,
      
      // Last seen timestamp
      lastSeen: data.last_seen,
      
      // Message
      message: data.message,
      
      queriedAt: new Date().toISOString(),
    };

    // Cache results
    await cachePut(cacheKey, result, TTL_SECONDS);

    return json(200, { ...result, cached: false });
  } catch (e) {
    console.error("GreyNoise error:", e);
    return json(500, { error: "GreyNoise lookup failed", details: e.message });
  }
};

