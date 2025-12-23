/**
 * ==============================================================================
 * NETKNIFE - REVERSE DNS (PTR) LOOKUP LAMBDA
 * ==============================================================================
 * 
 * Performs reverse DNS lookups to find PTR records for IP addresses.
 * Uses DNS-over-HTTPS (DoH) for reliable, consistent resolution.
 * 
 * REQUEST:
 *   POST { "ip": "8.8.8.8" }
 * 
 * RESPONSE:
 *   {
 *     "ip": "8.8.8.8",
 *     "ptr": "dns.google",
 *     "arpa": "8.8.8.8.in-addr.arpa",
 *     "cached": false
 *   }
 * 
 * CACHING:
 *   Results are cached in DynamoDB for 1 hour to reduce DoH queries.
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600"); // 1 hour default

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
// IP VALIDATION & CONVERSION
// ------------------------------------------------------------------------------

function isIPv4(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = Number(p);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

function isIPv6(ip) {
  // Basic IPv6 validation
  return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip) ||
         /^::$/.test(ip) ||
         /^::1$/.test(ip);
}

function ipToArpa(ip) {
  if (isIPv4(ip)) {
    // Reverse octets and append in-addr.arpa
    return ip.split(".").reverse().join(".") + ".in-addr.arpa";
  }
  
  if (isIPv6(ip)) {
    // Expand IPv6 and reverse nibbles
    const expanded = expandIPv6(ip);
    const nibbles = expanded.replace(/:/g, "").split("").reverse().join(".");
    return nibbles + ".ip6.arpa";
  }
  
  return null;
}

function expandIPv6(ip) {
  // Handle :: expansion
  const parts = ip.split("::");
  if (parts.length === 1) {
    // No ::, just pad each group
    return ip.split(":").map(p => p.padStart(4, "0")).join(":");
  }
  
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts[1] ? parts[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  const middle = Array(missing).fill("0000");
  
  return [...left.map(p => p.padStart(4, "0")), ...middle, ...right.map(p => p.padStart(4, "0"))].join(":");
}

// ------------------------------------------------------------------------------
// DNS-OVER-HTTPS QUERY
// ------------------------------------------------------------------------------

async function queryDoH(name, type) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  
  const response = await fetch(url, {
    headers: {
      "Accept": "application/dns-json",
    },
    timeout: 5000,
  });
  
  if (!response.ok) {
    throw new Error(`DoH query failed: ${response.status}`);
  }
  
  return response.json();
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
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    const ip = String(body.ip || "").trim();
    
    // Validate IP
    if (!ip) {
      return json(400, { error: "Missing required field: ip" });
    }
    
    if (!isIPv4(ip) && !isIPv6(ip)) {
      return json(400, { error: "Invalid IP address format" });
    }
    
    // Convert IP to ARPA format
    const arpa = ipToArpa(ip);
    if (!arpa) {
      return json(400, { error: "Could not convert IP to ARPA format" });
    }
    
    // Check cache
    const cacheKey = `ptr:${ip}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query PTR record via DoH
    const dohResult = await queryDoH(arpa, "PTR");
    
    // Extract PTR records
    const ptrRecords = (dohResult.Answer || [])
      .filter(r => r.type === 12) // Type 12 = PTR
      .map(r => r.data.replace(/\.$/, "")); // Remove trailing dot
    
    const result = {
      ip,
      arpa,
      ipVersion: isIPv4(ip) ? 4 : 6,
      ptr: ptrRecords.length > 0 ? ptrRecords : null,
      ptrCount: ptrRecords.length,
      status: dohResult.Status,
      statusText: dohResult.Status === 0 ? "NOERROR" : 
                  dohResult.Status === 3 ? "NXDOMAIN" : 
                  `RCODE_${dohResult.Status}`,
    };
    
    // Cache result
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("Reverse DNS error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};

