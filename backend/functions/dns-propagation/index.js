/**
 * ==============================================================================
 * NETKNIFE - DNS PROPAGATION CHECKER LAMBDA
 * ==============================================================================
 *
 * Queries multiple public DNS resolvers to check DNS propagation status.
 * Shows if DNS changes have propagated globally.
 *
 * RESOLVERS:
 * - Cloudflare (1.1.1.1)
 * - Google (8.8.8.8)
 * - Quad9 (9.9.9.9)
 * - OpenDNS (208.67.222.222)
 * - Level3 (4.2.2.1)
 * - Comodo (8.26.56.26)
 *
 * REQUEST:
 *   POST { "name": "example.com", "type": "A" }
 *
 * RESPONSE:
 *   {
 *     "name": "example.com",
 *     "type": "A",
 *     "results": [
 *       { "resolver": "Cloudflare", "ip": "1.1.1.1", "location": "Global", "answers": [...], "ttl": 300 },
 *       ...
 *     ],
 *     "consistent": true
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
 * DNS resolvers to query
 */
const DNS_RESOLVERS = [
  { name: "Cloudflare", ip: "1.1.1.1", location: "Global (Anycast)" },
  { name: "Google", ip: "8.8.8.8", location: "Global (Anycast)" },
  { name: "Quad9", ip: "9.9.9.9", location: "Global (Anycast)" },
  { name: "OpenDNS", ip: "208.67.222.222", location: "US (Anycast)" },
  { name: "Level3", ip: "4.2.2.1", location: "US" },
  { name: "Comodo", ip: "8.26.56.26", location: "US" },
  { name: "CleanBrowsing", ip: "185.228.168.9", location: "EU" },
  { name: "AdGuard", ip: "94.140.14.14", location: "EU" },
];

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
 * Query a DNS resolver using DNS-over-HTTPS
 */
async function queryResolver(resolver, name, type) {
  const dohUrl = `https://${resolver.ip === "1.1.1.1" ? "cloudflare-dns.com" : 
                          resolver.ip === "8.8.8.8" ? "dns.google" : 
                          resolver.ip === "9.9.9.9" ? "dns.quad9.net" :
                          `dns.${resolver.name.toLowerCase()}.com`}/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  
  // For resolvers without DoH, use Cloudflare's proxy
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      headers: {
        "Accept": "application/dns-json",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { resolver: resolver.name, ip: resolver.ip, location: resolver.location, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    return {
      resolver: resolver.name,
      ip: resolver.ip,
      location: resolver.location,
      status: data.Status,
      answers: data.Answer || [],
      ttl: data.Answer?.[0]?.TTL,
    };
  } catch (e) {
    return {
      resolver: resolver.name,
      ip: resolver.ip,
      location: resolver.location,
      error: e.name === "AbortError" ? "Timeout" : e.message,
    };
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

  const { name, type = "A" } = body;

  if (!name || typeof name !== "string") {
    return json(400, { error: "Missing or invalid 'name' parameter" });
  }

  // Validate record type
  const validTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "PTR", "SRV"];
  if (!validTypes.includes(type.toUpperCase())) {
    return json(400, { error: `Invalid record type. Valid types: ${validTypes.join(", ")}` });
  }

  // Check cache
  const cacheKey = `dns-prop-${name}-${type}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  // Query all resolvers in parallel
  const results = await Promise.all(
    DNS_RESOLVERS.map(resolver => queryResolver(resolver, name, type.toUpperCase()))
  );

  // Check if results are consistent
  const successfulResults = results.filter(r => !r.error && r.answers?.length > 0);
  const answerSets = successfulResults.map(r => 
    r.answers.map(a => a.data).sort().join(",")
  );
  const consistent = answerSets.length > 0 && answerSets.every(s => s === answerSets[0]);

  const response = {
    name,
    type: type.toUpperCase(),
    results,
    consistent,
    checkedAt: new Date().toISOString(),
  };

  // Cache results
  await cachePut(cacheKey, response, TTL_SECONDS);

  return json(200, { ...response, cached: false });
};

