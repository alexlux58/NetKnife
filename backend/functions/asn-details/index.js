/**
 * ==============================================================================
 * NETKNIFE - ASN DETAILS LAMBDA
 * ==============================================================================
 *
 * Fetches detailed Autonomous System Number (ASN) information using
 * RIPEstat and BGPView APIs.
 *
 * FEATURES:
 * - ASN overview and holder info
 * - Announced prefixes
 * - Peer count and upstream/downstream info
 * - RIR allocation info
 *
 * REQUEST:
 *   POST { "asn": "13335" } or { "asn": "AS13335" }
 *
 * RESPONSE:
 *   {
 *     "asn": 13335,
 *     "holder": "CLOUDFLARENET",
 *     "description": "Cloudflare, Inc.",
 *     "country": "US",
 *     "prefixes": { "ipv4": [...], "ipv6": [...] },
 *     "peers": { "upstreams": [...], "downstreams": [...] },
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
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600"); // 1 hour

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
 * Parse ASN from input (handles "AS13335", "13335", etc.)
 */
function parseAsn(input) {
  const match = String(input).match(/^(?:AS)?(\d+)$/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Fetch data with timeout
 */
async function fetchWithTimeout(url, timeout = 10000) {
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

  const { asn: asnInput } = body;
  const asn = parseAsn(asnInput);

  if (!asn || asn < 1 || asn > 4294967295) {
    return json(400, { error: "Invalid ASN. Must be a number between 1 and 4294967295." });
  }

  // Check cache
  const cacheKey = `asn-${asn}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  try {
    // Fetch data from BGPView API (more comprehensive than RIPEstat for basic info)
    const [asnResponse, prefixesResponse, peersResponse] = await Promise.all([
      fetchWithTimeout(`https://api.bgpview.io/asn/${asn}`).then(r => r.json()),
      fetchWithTimeout(`https://api.bgpview.io/asn/${asn}/prefixes`).then(r => r.json()),
      fetchWithTimeout(`https://api.bgpview.io/asn/${asn}/peers`).then(r => r.json()),
    ]);

    if (asnResponse.status !== "ok" || !asnResponse.data) {
      return json(404, { error: `ASN ${asn} not found` });
    }

    const asnData = asnResponse.data;
    const prefixData = prefixesResponse.data || {};
    const peerData = peersResponse.data || {};

    const result = {
      asn,
      name: asnData.name,
      description: asnData.description_short || asnData.description_full,
      country: asnData.country_code,
      rir: asnData.rir_allocation?.rir_name,
      rirAllocationDate: asnData.rir_allocation?.date_allocated,
      website: asnData.website,
      emailContacts: asnData.email_contacts,
      abuseContacts: asnData.abuse_contacts,
      lookingGlass: asnData.looking_glass,
      trafficEstimation: asnData.traffic_estimation,
      trafficRatio: asnData.traffic_ratio,
      
      prefixes: {
        ipv4Count: prefixData.ipv4_prefixes?.length || 0,
        ipv6Count: prefixData.ipv6_prefixes?.length || 0,
        ipv4: (prefixData.ipv4_prefixes || []).slice(0, 50).map(p => ({
          prefix: p.prefix,
          name: p.name,
          description: p.description,
          countryCode: p.country_code,
        })),
        ipv6: (prefixData.ipv6_prefixes || []).slice(0, 50).map(p => ({
          prefix: p.prefix,
          name: p.name,
          description: p.description,
          countryCode: p.country_code,
        })),
      },
      
      peers: {
        upstreamCount: peerData.ipv4_upstreams?.length || 0,
        downstreamCount: peerData.ipv4_downstreams?.length || 0,
        upstreams: (peerData.ipv4_upstreams || []).slice(0, 20).map(p => ({
          asn: p.asn,
          name: p.name,
          description: p.description,
          countryCode: p.country_code,
        })),
        downstreams: (peerData.ipv4_downstreams || []).slice(0, 20).map(p => ({
          asn: p.asn,
          name: p.name,
          description: p.description,
          countryCode: p.country_code,
        })),
      },
      
      queriedAt: new Date().toISOString(),
    };

    // Cache results
    await cachePut(cacheKey, result, TTL_SECONDS);

    return json(200, { ...result, cached: false });
  } catch (e) {
    console.error("ASN lookup error:", e);
    return json(500, { error: "ASN lookup failed", details: e.message });
  }
};

