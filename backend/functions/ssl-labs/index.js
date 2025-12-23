/**
 * ==============================================================================
 * NETKNIFE - SSL LABS LAMBDA
 * ==============================================================================
 *
 * Queries Qualys SSL Labs API to get SSL/TLS configuration grade.
 *
 * FEATURES:
 * - Overall grade (A+, A, B, C, etc.)
 * - Protocol support details
 * - Certificate information
 * - Known vulnerabilities (BEAST, POODLE, etc.)
 *
 * NOTE: SSL Labs API has rate limits. Results are cached heavily.
 *
 * REQUEST:
 *   POST { "host": "example.com" }
 *
 * RESPONSE:
 *   {
 *     "host": "example.com",
 *     "grade": "A+",
 *     "endpoints": [...],
 *     "protocols": [...],
 *     ...
 *   }
 *
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "86400"); // 24 hours (SSL Labs results don't change frequently)

const SSL_LABS_API = "https://api.ssllabs.com/api/v3";

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
 * Validate hostname
 */
function isValidHost(host) {
  // Basic hostname validation
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(host);
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { "User-Agent": "NetKnife/1.0" }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return json(400, { error: "Invalid JSON body" });
  }

  const { host } = body;

  if (!host || typeof host !== "string" || !isValidHost(host.trim())) {
    return json(400, { error: "Invalid hostname" });
  }

  const cleanHost = host.trim().toLowerCase();

  // Check cache
  const cacheKey = `ssl-labs-${cleanHost}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  try {
    // First, check if there's an existing cached result on SSL Labs
    // Using fromCache=on to avoid triggering new scans
    const cacheCheckUrl = `${SSL_LABS_API}/analyze?host=${encodeURIComponent(cleanHost)}&fromCache=on&all=done`;
    const cacheResponse = await fetchWithTimeout(cacheCheckUrl);
    
    if (!cacheResponse.ok) {
      const errorBody = await cacheResponse.text();
      console.error("SSL Labs API error:", cacheResponse.status, errorBody);
      
      if (cacheResponse.status === 429) {
        return json(429, { error: "SSL Labs rate limit exceeded. Try again later." });
      }
      
      return json(cacheResponse.status, { error: `SSL Labs API error: ${cacheResponse.statusText}` });
    }
    
    const data = await cacheResponse.json();
    
    // If no cached result, start a new scan but don't wait for it
    if (data.status === "DNS" || data.status === "ERROR") {
      // Start scan in background (don't wait)
      fetch(`${SSL_LABS_API}/analyze?host=${encodeURIComponent(cleanHost)}&startNew=off&all=done`)
        .catch(() => {}); // Ignore errors
      
      return json(202, {
        host: cleanHost,
        status: "pending",
        message: "SSL Labs scan not available. A new scan has been initiated. Try again in a few minutes.",
      });
    }
    
    // If scan is in progress
    if (data.status === "IN_PROGRESS") {
      return json(202, {
        host: cleanHost,
        status: "in_progress",
        message: "SSL Labs scan in progress. Try again in a few minutes.",
        progress: data.endpoints?.[0]?.progress,
      });
    }
    
    // If scan is ready
    if (data.status === "READY") {
      const result = {
        host: cleanHost,
        status: "ready",
        startTime: new Date(data.startTime).toISOString(),
        testTime: new Date(data.testTime).toISOString(),
        engineVersion: data.engineVersion,
        criteriaVersion: data.criteriaVersion,
        
        // Overall grade from first endpoint
        grade: data.endpoints?.[0]?.grade,
        gradeTrustIgnored: data.endpoints?.[0]?.gradeTrustIgnored,
        hasWarnings: data.endpoints?.[0]?.hasWarnings,
        isExceptional: data.endpoints?.[0]?.isExceptional,
        
        // Endpoints summary
        endpoints: (data.endpoints || []).map(ep => ({
          ipAddress: ep.ipAddress,
          serverName: ep.serverName,
          grade: ep.grade,
          gradeTrustIgnored: ep.gradeTrustIgnored,
          hasWarnings: ep.hasWarnings,
          isExceptional: ep.isExceptional,
          progress: ep.progress,
          duration: ep.duration,
          delegation: ep.delegation,
        })),
        
        // Protocol support (from first endpoint's details if available)
        protocols: data.endpoints?.[0]?.details?.protocols?.map(p => ({
          name: p.name,
          version: p.version,
        })),
        
        // Vulnerabilities
        vulnerabilities: data.endpoints?.[0]?.details ? {
          beast: data.endpoints[0].details.vulnBeast,
          poodle: data.endpoints[0].details.poodle,
          poodleTls: data.endpoints[0].details.poodleTls,
          heartbleed: data.endpoints[0].details.heartbleed,
          heartbeat: data.endpoints[0].details.heartbeat,
          openSslCcs: data.endpoints[0].details.openSslCcs,
          openSSLLuckyMinus20: data.endpoints[0].details.openSSLLuckyMinus20,
          ticketbleed: data.endpoints[0].details.ticketbleed,
          bleichenbacher: data.endpoints[0].details.bleichenbacher,
          zombiePoodle: data.endpoints[0].details.zombiePoodle,
          goldenDoodle: data.endpoints[0].details.goldenDoodle,
          zeroLengthPaddingOracle: data.endpoints[0].details.zeroLengthPaddingOracle,
          sleepingPoodle: data.endpoints[0].details.sleepingPoodle,
          freak: data.endpoints[0].details.freak,
          logjam: data.endpoints[0].details.logjam,
          drownVulnerable: data.endpoints[0].details.drownVulnerable,
        } : null,
        
        queriedAt: new Date().toISOString(),
      };

      // Cache results
      await cachePut(cacheKey, result, TTL_SECONDS);

      return json(200, { ...result, cached: false });
    }
    
    // Unknown status
    return json(500, { error: `Unknown SSL Labs status: ${data.status}` });
    
  } catch (e) {
    console.error("SSL Labs error:", e);
    return json(500, { error: "SSL Labs lookup failed", details: e.message });
  }
};

