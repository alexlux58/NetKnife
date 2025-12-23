/**
 * ==============================================================================
 * NETKNIFE - TRACEROUTE LAMBDA
 * ==============================================================================
 *
 * Performs a traceroute-like lookup using RIPEstat's tracepath visualization.
 * Since Lambda can't run raw ICMP, we use BGP-based path analysis.
 *
 * FEATURES:
 * - AS path analysis
 * - Geographic hop information
 * - Network owner identification per hop
 *
 * REQUEST:
 *   POST { "target": "8.8.8.8" }
 *
 * RESPONSE:
 *   {
 *     "target": "8.8.8.8",
 *     "hops": [
 *       { "asn": 13335, "name": "Cloudflare", ... },
 *       ...
 *     ],
 *     ...
 *   }
 *
 * NOTE: This is a BGP-based AS path trace, not a traditional ICMP traceroute.
 *       For actual latency measurements, a dedicated traceroute server is needed.
 *
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "600"); // 10 minutes

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
 * Validate IP address or hostname
 */
function isValidTarget(target) {
  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target)) {
    return true;
  }
  // Hostname
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(target)) {
    return true;
  }
  // IPv6
  if (target.includes(':')) {
    return true;
  }
  return false;
}

/**
 * Check if IP is private/reserved
 */
function isPrivateIP(ip) {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^0\./,
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./,
  ];
  return privateRanges.some(r => r.test(ip));
}

/**
 * Fetch with timeout
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

  const { target } = body;

  if (!target || typeof target !== "string" || !isValidTarget(target.trim())) {
    return json(400, { error: "Invalid target. Must be an IP address or hostname." });
  }

  const cleanTarget = target.trim();

  // Block private IPs
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanTarget) && isPrivateIP(cleanTarget)) {
    return json(400, { error: "Cannot trace to private IP addresses." });
  }

  // Check cache
  const cacheKey = `traceroute-${cleanTarget}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  try {
    // Resolve hostname to IP if needed
    let targetIP = cleanTarget;
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanTarget)) {
      // Use DNS lookup
      const dnsResponse = await fetchWithTimeout(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanTarget)}&type=A`,
        { headers: { "Accept": "application/dns-json" } }
      );
      const dnsData = await dnsResponse.json();
      if (dnsData.Answer && dnsData.Answer.length > 0) {
        targetIP = dnsData.Answer[0].data;
      } else {
        return json(400, { error: "Could not resolve hostname to IP address" });
      }
    }

    // Use RIPEstat's looking glass for AS path
    const [lookingGlass, geoData] = await Promise.all([
      fetchWithTimeout(`https://stat.ripe.net/data/looking-glass/data.json?resource=${encodeURIComponent(targetIP)}`)
        .then(r => r.json()),
      fetchWithTimeout(`https://stat.ripe.net/data/geoloc/data.json?resource=${encodeURIComponent(targetIP)}`)
        .then(r => r.json()),
    ]);

    // Extract AS path from first available RRC
    let asPath = [];
    const rrcs = lookingGlass.data?.rrcs || [];
    for (const rrc of rrcs) {
      if (rrc.peers && rrc.peers.length > 0) {
        const peer = rrc.peers[0];
        if (peer.as_path) {
          asPath = peer.as_path.split(' ').map(a => parseInt(a, 10)).filter(a => !isNaN(a));
          break;
        }
      }
    }

    // Get details for each AS in the path
    const hops = await Promise.all(asPath.map(async (asn, index) => {
      try {
        const asnResponse = await fetchWithTimeout(`https://api.bgpview.io/asn/${asn}`);
        const asnData = await asnResponse.json();
        
        return {
          hop: index + 1,
          asn,
          name: asnData.data?.name || `AS${asn}`,
          description: asnData.data?.description_short,
          countryCode: asnData.data?.country_code,
        };
      } catch {
        return {
          hop: index + 1,
          asn,
          name: `AS${asn}`,
          description: null,
          countryCode: null,
        };
      }
    }));

    // Get geolocation for target
    const geoLocations = geoData.data?.locations || [];
    const targetGeo = geoLocations.length > 0 ? {
      city: geoLocations[0].city,
      country: geoLocations[0].country,
      latitude: geoLocations[0].latitude,
      longitude: geoLocations[0].longitude,
    } : null;

    const result = {
      target: cleanTarget,
      resolvedIP: targetIP,
      type: "AS Path Trace",
      note: "This is a BGP-based AS path trace, not a traditional ICMP traceroute. It shows the autonomous systems along the routing path, not individual routers.",
      hops,
      hopCount: hops.length,
      originASN: hops.length > 0 ? hops[hops.length - 1].asn : null,
      targetGeolocation: targetGeo,
      queriedAt: new Date().toISOString(),
    };

    // Cache results
    await cachePut(cacheKey, result, TTL_SECONDS);

    return json(200, { ...result, cached: false });
  } catch (e) {
    console.error("Traceroute error:", e);
    return json(500, { error: "Traceroute failed", details: e.message });
  }
};

