/**
 * ==============================================================================
 * NETKNIFE - ABUSEIPDB LOOKUP LAMBDA
 * ==============================================================================
 * 
 * Checks IP reputation against AbuseIPDB - a crowd-sourced database of
 * malicious IP addresses reported by security professionals worldwide.
 * 
 * WHAT ABUSEIPDB PROVIDES:
 * - Abuse Confidence Score (0-100%) - likelihood IP is malicious
 * - Total reports count - how many times reported
 * - Report categories - types of abuse (SSH brute force, spam, etc.)
 * - Country of origin, ISP, usage type
 * - Recent reports with timestamps
 * 
 * REQUEST:
 *   POST { "ip": "185.220.101.1" }
 * 
 * RESPONSE:
 *   {
 *     "ip": "185.220.101.1",
 *     "abuseConfidenceScore": 100,
 *     "totalReports": 5432,
 *     "countryCode": "DE",
 *     "isp": "Example ISP",
 *     "usageType": "Data Center/Web Hosting",
 *     "domain": "example.com",
 *     "isTor": true,
 *     "lastReportedAt": "2024-01-15T10:30:00+00:00",
 *     "cached": false
 *   }
 * 
 * RATE LIMITING:
 * - Free tier: 1,000 checks/day
 * - Results cached for 1 hour to conserve quota
 * 
 * ENVIRONMENT VARIABLES:
 * - CACHE_TABLE: DynamoDB table name
 * - CACHE_TTL_SECONDS: Cache TTL (default: 3600 = 1 hour)
 * - ABUSEIPDB_API_KEY: API key from abuseipdb.com
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client (SDK v3)
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

// Configuration from environment
const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600"); // 1 hour default
const API_KEY = process.env.ABUSEIPDB_API_KEY;

// AbuseIPDB API endpoint
const ABUSEIPDB_API = "https://api.abuseipdb.com/api/v2/check";

// Abuse category mapping (from AbuseIPDB documentation)
const ABUSE_CATEGORIES = {
  1: "DNS Compromise",
  2: "DNS Poisoning",
  3: "Fraud Orders",
  4: "DDoS Attack",
  5: "FTP Brute-Force",
  6: "Ping of Death",
  7: "Phishing",
  8: "Fraud VoIP",
  9: "Open Proxy",
  10: "Web Spam",
  11: "Email Spam",
  12: "Blog Spam",
  13: "VPN IP",
  14: "Port Scan",
  15: "Hacking",
  16: "SQL Injection",
  17: "Spoofing",
  18: "Brute-Force",
  19: "Bad Web Bot",
  20: "Exploited Host",
  21: "Web App Attack",
  22: "SSH",
  23: "IoT Targeted"
};

// ------------------------------------------------------------------------------
// CACHE HELPERS
// ------------------------------------------------------------------------------

async function cacheGet(key) {
  if (!CACHE_TABLE) return null;
  try {
    const res = await ddb.send(new GetCommand({
      TableName: CACHE_TABLE,
      Key: { cache_key: key },
    }));
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
// IP VALIDATION
// ------------------------------------------------------------------------------

function isValidIPv4(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = Number(p);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

function isValidIPv6(ip) {
  // Basic IPv6 validation (allows :: shorthand)
  const ipv6Regex = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(?:ffff(?::0{1,4})?:)?(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9]))$/i;
  return ipv6Regex.test(ip);
}

function isValidIP(ip) {
  return isValidIPv4(ip) || isValidIPv6(ip);
}

// Check if IP is private/reserved (shouldn't be queried)
function isPrivateIP(ip) {
  if (isValidIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
  }
  // IPv6 private ranges
  if (isValidIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80")) return true; // Link-local
    if (lower === "::1" || lower === "::") return true; // Loopback/unspecified
  }
  return false;
}

// ------------------------------------------------------------------------------
// ABUSEIPDB API QUERY
// ------------------------------------------------------------------------------

async function queryAbuseIPDB(ip) {
  const url = new URL(ABUSEIPDB_API);
  url.searchParams.set("ipAddress", ip);
  url.searchParams.set("maxAgeInDays", "90"); // Reports from last 90 days
  url.searchParams.set("verbose", "true");    // Include recent reports

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Key": API_KEY,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AbuseIPDB API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ------------------------------------------------------------------------------
// RESPONSE HELPERS
// ------------------------------------------------------------------------------

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

// Convert category IDs to human-readable names
function mapCategories(categoryIds) {
  if (!categoryIds || !Array.isArray(categoryIds)) return [];
  return categoryIds.map(id => ({
    id,
    name: ABUSE_CATEGORIES[id] || `Unknown (${id})`,
  }));
}

// Calculate threat level based on confidence score
function getThreatLevel(score) {
  if (score >= 75) return { level: "critical", color: "red", emoji: "🔴" };
  if (score >= 50) return { level: "high", color: "orange", emoji: "🟠" };
  if (score >= 25) return { level: "medium", color: "yellow", emoji: "🟡" };
  if (score > 0) return { level: "low", color: "blue", emoji: "🔵" };
  return { level: "clean", color: "green", emoji: "🟢" };
}

// ------------------------------------------------------------------------------
// LAMBDA HANDLER
// ------------------------------------------------------------------------------

exports.handler = async (event) => {
  console.log("AbuseIPDB lookup request received");

  // Check if API key is configured
  if (!API_KEY) {
    return json(500, {
      error: "AbuseIPDB API key not configured",
      message: "Please set ABUSEIPDB_API_KEY environment variable",
    });
  }

  // Parse request body
  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch (e) {
    return json(400, { error: "Invalid JSON body" });
  }

  const { ip } = body || {};

  // Validate IP
  if (!ip || typeof ip !== "string") {
    return json(400, { error: "Missing required parameter: ip" });
  }

  const cleanIP = ip.trim();

  if (!isValidIP(cleanIP)) {
    return json(400, { error: "Invalid IP address format" });
  }

  if (isPrivateIP(cleanIP)) {
    return json(400, { 
      error: "Private/reserved IP addresses cannot be checked",
      ip: cleanIP,
    });
  }

  // Check cache first
  const cacheKey = `abuseipdb:${cleanIP}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    console.log(`Cache hit for ${cleanIP}`);
    return json(200, { ...cached, cached: true });
  }

  // Query AbuseIPDB
  try {
    console.log(`Querying AbuseIPDB for ${cleanIP}`);
    const apiResponse = await queryAbuseIPDB(cleanIP);

    if (!apiResponse.data) {
      throw new Error("Invalid response from AbuseIPDB");
    }

    const data = apiResponse.data;
    const threatLevel = getThreatLevel(data.abuseConfidenceScore);

    // Build clean response
    const result = {
      ip: cleanIP,
      abuseConfidenceScore: data.abuseConfidenceScore,
      threatLevel: threatLevel,
      totalReports: data.totalReports,
      numDistinctUsers: data.numDistinctUsers,
      lastReportedAt: data.lastReportedAt,
      countryCode: data.countryCode,
      countryName: data.countryName,
      isp: data.isp,
      domain: data.domain,
      usageType: data.usageType,
      hostnames: data.hostnames || [],
      isTor: data.isTor,
      isWhitelisted: data.isWhitelisted,
      // Map category IDs to names
      categories: mapCategories(
        data.reports?.reduce((acc, r) => {
          r.categories?.forEach(c => {
            if (!acc.includes(c)) acc.push(c);
          });
          return acc;
        }, [])
      ),
      // Include recent reports (limited to 5 most recent)
      recentReports: (data.reports || []).slice(0, 5).map(r => ({
        reportedAt: r.reportedAt,
        comment: r.comment,
        categories: mapCategories(r.categories),
        reporterId: r.reporterId,
        reporterCountryCode: r.reporterCountryCode,
      })),
      cached: false,
    };

    // Cache the result
    await cachePut(cacheKey, result, TTL_SECONDS);

    return json(200, result);
  } catch (error) {
    console.error("AbuseIPDB query error:", error);
    return json(502, {
      error: "Failed to query AbuseIPDB",
      message: error.message,
      ip: cleanIP,
    });
  }
};

