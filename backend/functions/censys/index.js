/**
 * ==============================================================================
 * NETKNIFE - CENSYS LAMBDA
 * ==============================================================================
 *
 * Queries Censys API for host and certificate information.
 *
 * FEATURES:
 * - Host services and ports
 * - TLS/SSL certificates
 * - Operating system detection
 * - Autonomous system info
 *
 * REQUIRES: CENSYS_API_ID and CENSYS_API_SECRET environment variables
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
const CENSYS_API_ID = process.env.CENSYS_API_ID;
const CENSYS_API_SECRET = process.env.CENSYS_API_SECRET;

const CENSYS_API_BASE = "https://search.censys.io/api/v2";

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
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) || ip.includes(':');
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  if (!CENSYS_API_ID || !CENSYS_API_SECRET) {
    return json(501, { error: "Censys integration not configured. API ID and Secret required." });
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

  // Check cache
  const cacheKey = `censys-${ip}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  try {
    const auth = Buffer.from(`${CENSYS_API_ID}:${CENSYS_API_SECRET}`).toString('base64');
    
    const response = await fetch(`${CENSYS_API_BASE}/hosts/${ip}`, {
      headers: {
        "Authorization": `Basic ${auth}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return json(404, { error: "IP not found in Censys database" });
      }
      if (response.status === 401 || response.status === 403) {
        return json(401, { error: "Invalid Censys API credentials" });
      }
      if (response.status === 429) {
        return json(429, { error: "Censys rate limit exceeded" });
      }
      return json(response.status, { error: `Censys API error: ${response.statusText}` });
    }

    const data = await response.json();
    const hostData = data.result || {};

    const result = {
      ip,
      lastUpdated: hostData.last_updated_at,
      
      // Location
      location: {
        city: hostData.location?.city,
        province: hostData.location?.province,
        country: hostData.location?.country,
        countryCode: hostData.location?.country_code,
        continent: hostData.location?.continent,
        coordinates: hostData.location?.coordinates,
        timezone: hostData.location?.timezone,
      },
      
      // Autonomous System
      autonomousSystem: {
        asn: hostData.autonomous_system?.asn,
        name: hostData.autonomous_system?.name,
        description: hostData.autonomous_system?.description,
        bgpPrefix: hostData.autonomous_system?.bgp_prefix,
        countryCode: hostData.autonomous_system?.country_code,
      },
      
      // Operating System
      operatingSystem: {
        product: hostData.operating_system?.product,
        vendor: hostData.operating_system?.vendor,
        version: hostData.operating_system?.version,
        edition: hostData.operating_system?.edition,
      },
      
      // Services
      services: (hostData.services || []).slice(0, 30).map(svc => ({
        port: svc.port,
        serviceName: svc.service_name,
        transportProtocol: svc.transport_protocol,
        extendedServiceName: svc.extended_service_name,
        certificate: svc.certificate ? {
          fingerprint: svc.certificate.fingerprint_sha256,
          issuer: svc.certificate.parsed?.issuer_dn,
          subject: svc.certificate.parsed?.subject_dn,
          validityStart: svc.certificate.parsed?.validity?.start,
          validityEnd: svc.certificate.parsed?.validity?.end,
        } : null,
        software: svc.software?.map(sw => ({
          vendor: sw.vendor,
          product: sw.product,
          version: sw.version,
        })),
        banner: svc.banner?.substring(0, 200),
      })),
      
      // Labels
      labels: hostData.labels || [],
      
      queriedAt: new Date().toISOString(),
    };

    // Cache results
    await cachePut(cacheKey, result, TTL_SECONDS);

    return json(200, { ...result, cached: false });
  } catch (e) {
    console.error("Censys error:", e);
    return json(500, { error: "Censys lookup failed", details: e.message });
  }
};

