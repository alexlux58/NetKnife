/**
 * ==============================================================================
 * NETKNIFE - BGP LOOKING GLASS LAMBDA
 * ==============================================================================
 *
 * Queries BGP routing information from public route servers using RIPEstat.
 * Shows BGP paths, AS paths, and routing visibility.
 *
 * FEATURES:
 * - Query by IP address or prefix
 * - Shows AS path from multiple vantage points
 * - Origin ASN identification
 * - Route visibility percentage
 *
 * REQUEST:
 *   POST { "query": "8.8.8.8" } or { "query": "8.8.8.0/24" }
 *
 * RESPONSE:
 *   {
 *     "query": "8.8.8.8",
 *     "prefix": "8.8.8.0/24",
 *     "origin_asn": 15169,
 *     "as_path": [...],
 *     "visibility": {...},
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
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "300"); // 5 minutes

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
 * Validate IP address or CIDR
 */
function isValidQuery(query) {
  // IPv4 address
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(query)) {
    return true;
  }
  // IPv4 CIDR
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(query)) {
    return true;
  }
  // IPv6 address or CIDR (simplified check)
  if (query.includes(':')) {
    return true;
  }
  return false;
}

/**
 * Fetch data with timeout
 */
async function fetchWithTimeout(url, timeout = 15000) {
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

  const { query } = body;

  if (!query || typeof query !== "string" || !isValidQuery(query.trim())) {
    return json(400, { error: "Invalid query. Must be an IP address or CIDR prefix." });
  }

  const cleanQuery = query.trim();

  // Check cache
  const cacheKey = `bgp-lg-${cleanQuery}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  try {
    // Use RIPEstat API for BGP looking glass functionality
    const [prefixOverview, routingStatus, asPath] = await Promise.all([
      // Get prefix overview
      fetchWithTimeout(`https://stat.ripe.net/data/prefix-overview/data.json?resource=${encodeURIComponent(cleanQuery)}`)
        .then(r => r.json()),
      // Get routing status
      fetchWithTimeout(`https://stat.ripe.net/data/routing-status/data.json?resource=${encodeURIComponent(cleanQuery)}`)
        .then(r => r.json()),
      // Get AS path
      fetchWithTimeout(`https://stat.ripe.net/data/looking-glass/data.json?resource=${encodeURIComponent(cleanQuery)}`)
        .then(r => r.json()),
    ]);

    const prefixData = prefixOverview.data || {};
    const routingData = routingStatus.data || {};
    const pathData = asPath.data || {};

    // Extract origin ASNs
    const originAsns = (prefixData.asns || []).map(a => ({
      asn: a.asn,
      holder: a.holder,
    }));

    // Extract routing visibility
    const visibility = {
      v4Visibility: routingData.visibility?.v4 || null,
      v6Visibility: routingData.visibility?.v6 || null,
      firstSeen: routingData.first_seen || null,
      lastSeen: routingData.last_seen || null,
    };

    // Extract AS paths from multiple RRCs
    const routes = (pathData.rrcs || []).slice(0, 20).map(rrc => ({
      rrc: rrc.rrc,
      location: rrc.location,
      peers: (rrc.peers || []).slice(0, 5).map(peer => ({
        asn: peer.asn_origin,
        prefix: peer.prefix,
        asPath: peer.as_path,
        community: peer.community,
      })),
    }));

    const result = {
      query: cleanQuery,
      prefix: prefixData.resource,
      isLessSpecific: prefixData.is_less_specific,
      block: {
        resource: prefixData.block?.resource,
        name: prefixData.block?.name,
        description: prefixData.block?.desc,
      },
      originAsns,
      visibility,
      routes,
      announcements: routingData.announced_space || 0,
      queriedAt: new Date().toISOString(),
    };

    // Cache results
    await cachePut(cacheKey, result, TTL_SECONDS);

    return json(200, { ...result, cached: false });
  } catch (e) {
    console.error("BGP looking glass error:", e);
    return json(500, { error: "BGP lookup failed", details: e.message });
  }
};

