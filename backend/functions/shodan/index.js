/**
 * ==============================================================================
 * NETKNIFE - SHODAN LAMBDA
 * ==============================================================================
 *
 * Queries Shodan API for host information and exposed services.
 *
 * FEATURES:
 * - Open ports and services
 * - Banners and version info
 * - Vulnerabilities (CVEs)
 * - Geolocation
 * - Historical data
 *
 * REQUIRES: SHODAN_API_KEY environment variable
 *
 * REQUEST:
 *   POST { "ip": "8.8.8.8" }
 *
 * RESPONSE:
 *   {
 *     "ip": "8.8.8.8",
 *     "ports": [53, 443],
 *     "vulns": [...],
 *     "data": [...]
 *   }
 *
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600"); // 1 hour
const SHODAN_API_KEY = process.env.SHODAN_API_KEY;

const SHODAN_API_BASE = "https://api.shodan.io";

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
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) ||
         ip.includes(':'); // IPv6
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
    /^0\./,
  ];
  return privateRanges.some(r => r.test(ip));
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  if (!SHODAN_API_KEY) {
    return json(501, { error: "Shodan integration not configured. API key required." });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return json(400, { error: "Invalid JSON body" });
  }

  const { ip } = body;

  if (!ip || !isValidIP(ip)) {
    return json(400, { error: "Invalid IP address" });
  }

  if (isPrivateIP(ip)) {
    return json(400, { error: "Cannot query private IP addresses" });
  }

  // Check cache
  const cacheKey = `shodan-${ip}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  try {
    const response = await fetch(`${SHODAN_API_BASE}/shodan/host/${ip}?key=${SHODAN_API_KEY}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return json(404, { error: "No information available for this IP", ip });
      }
      if (response.status === 401) {
        return json(401, { error: "Invalid Shodan API key" });
      }
      return json(response.status, { error: `Shodan API error: ${response.statusText}` });
    }

    const data = await response.json();

    const result = {
      ip: data.ip_str,
      hostnames: data.hostnames || [],
      city: data.city,
      region: data.region_code,
      country: data.country_code,
      countryName: data.country_name,
      org: data.org,
      isp: data.isp,
      asn: data.asn,
      latitude: data.latitude,
      longitude: data.longitude,
      lastUpdate: data.last_update,
      
      // Open ports
      ports: data.ports || [],
      
      // Vulnerabilities
      vulns: data.vulns || [],
      
      // Services/banners
      services: (data.data || []).map(service => ({
        port: service.port,
        transport: service.transport,
        product: service.product,
        version: service.version,
        cpe: service.cpe,
        banner: service.data?.substring(0, 500), // Truncate long banners
        ssl: service.ssl ? {
          cert: {
            subject: service.ssl.cert?.subject,
            issuer: service.ssl.cert?.issuer,
            expires: service.ssl.cert?.expires,
          },
          versions: service.ssl.versions,
        } : null,
      })),
      
      // Tags
      tags: data.tags || [],
      
      queriedAt: new Date().toISOString(),
    };

    // Cache results
    await cachePut(cacheKey, result, TTL_SECONDS);

    return json(200, { ...result, cached: false });
  } catch (e) {
    console.error("Shodan error:", e);
    return json(500, { error: "Shodan lookup failed", details: e.message });
  }
};

