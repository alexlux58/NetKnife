/**
 * ==============================================================================
 * NETKNIFE - EMAIL AUTHENTICATION (SPF/DKIM/DMARC) CHECKER LAMBDA
 * ==============================================================================
 * 
 * Validates email authentication records for a domain.
 * Checks SPF, DKIM, and DMARC configurations.
 * 
 * REQUEST:
 *   POST { "domain": "example.com", "dkimSelector": "default" }
 * 
 * RESPONSE:
 *   {
 *     "domain": "example.com",
 *     "spf": { "found": true, "record": "v=spf1 ...", "valid": true },
 *     "dmarc": { "found": true, "record": "v=DMARC1 ...", "policy": "reject" },
 *     "dkim": { "found": true, "record": "v=DKIM1 ..." },
 *     "cached": false
 *   }
 * 
 * CACHING:
 *   Results are cached in DynamoDB for 1 hour.
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600");

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
// DOMAIN VALIDATION
// ------------------------------------------------------------------------------

function isValidDomain(domain) {
  // Basic domain validation
  if (!domain || domain.length > 253) return false;
  const parts = domain.split(".");
  if (parts.length < 2) return false;
  return parts.every(p => /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(p) && p.length <= 63);
}

// ------------------------------------------------------------------------------
// DNS-OVER-HTTPS QUERY
// ------------------------------------------------------------------------------

async function queryDoH(name, type) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  
  const response = await fetch(url, {
    headers: { "Accept": "application/dns-json" },
    timeout: 5000,
  });
  
  if (!response.ok) {
    throw new Error(`DoH query failed: ${response.status}`);
  }
  
  return response.json();
}

async function getTxtRecords(name) {
  try {
    const result = await queryDoH(name, "TXT");
    return (result.Answer || [])
      .filter(r => r.type === 16) // Type 16 = TXT
      .map(r => r.data.replace(/^"|"$/g, "").replace(/"\s*"/g, "")); // Remove quotes
  } catch (e) {
    console.warn(`TXT query for ${name} failed:`, e.message);
    return [];
  }
}

// ------------------------------------------------------------------------------
// SPF CHECKER
// ------------------------------------------------------------------------------

async function checkSPF(domain) {
  const records = await getTxtRecords(domain);
  const spfRecords = records.filter(r => r.startsWith("v=spf1"));
  
  if (spfRecords.length === 0) {
    return { found: false, error: "No SPF record found" };
  }
  
  if (spfRecords.length > 1) {
    return {
      found: true,
      record: spfRecords[0],
      warning: `Multiple SPF records found (${spfRecords.length}). This can cause delivery issues.`,
      valid: false,
    };
  }
  
  const record = spfRecords[0];
  const analysis = analyzeSPF(record);
  
  return {
    found: true,
    record,
    ...analysis,
  };
}

function analyzeSPF(record) {
  const mechanisms = record.split(/\s+/).slice(1); // Skip v=spf1
  const result = {
    valid: true,
    mechanisms: [],
    warnings: [],
    includes: [],
    all: null,
  };
  
  for (const mech of mechanisms) {
    if (mech.startsWith("include:")) {
      result.includes.push(mech.substring(8));
      result.mechanisms.push({ type: "include", value: mech.substring(8) });
    } else if (mech.startsWith("a") || mech === "a") {
      result.mechanisms.push({ type: "a", value: mech });
    } else if (mech.startsWith("mx") || mech === "mx") {
      result.mechanisms.push({ type: "mx", value: mech });
    } else if (mech.startsWith("ip4:")) {
      result.mechanisms.push({ type: "ip4", value: mech.substring(4) });
    } else if (mech.startsWith("ip6:")) {
      result.mechanisms.push({ type: "ip6", value: mech.substring(4) });
    } else if (mech === "~all") {
      result.all = "softfail";
    } else if (mech === "-all") {
      result.all = "fail";
    } else if (mech === "+all" || mech === "all") {
      result.all = "pass";
      result.warnings.push("Using +all is insecure - anyone can send as your domain");
    } else if (mech === "?all") {
      result.all = "neutral";
      result.warnings.push("Using ?all provides no protection");
    }
  }
  
  if (!result.all) {
    result.warnings.push("No 'all' mechanism found - implicit +all is applied");
  }
  
  if (result.includes.length > 10) {
    result.warnings.push("Too many includes - may exceed DNS lookup limit (10)");
  }
  
  return result;
}

// ------------------------------------------------------------------------------
// DMARC CHECKER
// ------------------------------------------------------------------------------

async function checkDMARC(domain) {
  const dmarcDomain = `_dmarc.${domain}`;
  const records = await getTxtRecords(dmarcDomain);
  const dmarcRecords = records.filter(r => r.startsWith("v=DMARC1"));
  
  if (dmarcRecords.length === 0) {
    return { found: false, error: "No DMARC record found" };
  }
  
  const record = dmarcRecords[0];
  const analysis = analyzeDMARC(record);
  
  return {
    found: true,
    record,
    ...analysis,
  };
}

function analyzeDMARC(record) {
  const tags = {};
  const parts = record.split(";").map(p => p.trim());
  
  for (const part of parts) {
    const [key, value] = part.split("=").map(s => s.trim());
    if (key && value) {
      tags[key] = value;
    }
  }
  
  const result = {
    policy: tags.p || "none",
    subdomainPolicy: tags.sp || tags.p || "none",
    percentage: Number(tags.pct) || 100,
    rua: tags.rua ? tags.rua.split(",").map(s => s.trim()) : [],
    ruf: tags.ruf ? tags.ruf.split(",").map(s => s.trim()) : [],
    alignmentDKIM: tags.adkim || "r",
    alignmentSPF: tags.aspf || "r",
    warnings: [],
  };
  
  if (result.policy === "none") {
    result.warnings.push("Policy is 'none' - DMARC is only monitoring, not enforcing");
  }
  
  if (result.rua.length === 0) {
    result.warnings.push("No aggregate report URI (rua) configured");
  }
  
  if (result.percentage < 100) {
    result.warnings.push(`Only ${result.percentage}% of mail is being checked`);
  }
  
  return result;
}

// ------------------------------------------------------------------------------
// DKIM CHECKER
// ------------------------------------------------------------------------------

async function checkDKIM(domain, selector) {
  const dkimDomain = `${selector}._domainkey.${domain}`;
  const records = await getTxtRecords(dkimDomain);
  
  if (records.length === 0) {
    return { 
      found: false, 
      selector,
      error: `No DKIM record found for selector '${selector}'`,
    };
  }
  
  const record = records.find(r => r.includes("v=DKIM1") || r.includes("p="));
  if (!record) {
    return {
      found: false,
      selector,
      error: "TXT record found but not a valid DKIM record",
    };
  }
  
  const analysis = analyzeDKIM(record);
  
  return {
    found: true,
    selector,
    record,
    ...analysis,
  };
}

function analyzeDKIM(record) {
  const tags = {};
  const parts = record.split(";").map(p => p.trim());
  
  for (const part of parts) {
    const [key, ...valueParts] = part.split("=");
    if (key) {
      tags[key.trim()] = valueParts.join("=").trim();
    }
  }
  
  const result = {
    version: tags.v || "DKIM1",
    keyType: tags.k || "rsa",
    hasPublicKey: !!tags.p,
    publicKeyLength: tags.p ? Math.floor(tags.p.length * 6 / 8) : 0, // Approximate
    flags: tags.t ? tags.t.split(":") : [],
    warnings: [],
  };
  
  if (!tags.p) {
    result.warnings.push("No public key (p=) found - DKIM is revoked");
  }
  
  if (result.publicKeyLength < 128 && tags.p) {
    result.warnings.push("Public key appears very short - may be weak");
  }
  
  return result;
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
    const body = event.body ? JSON.parse(event.body) : {};
    const domain = String(body.domain || "").trim().toLowerCase();
    const dkimSelector = String(body.dkimSelector || "default").trim();
    
    if (!domain) {
      return json(400, { error: "Missing required field: domain" });
    }
    
    if (!isValidDomain(domain)) {
      return json(400, { error: "Invalid domain format" });
    }
    
    // Check cache
    const cacheKey = `email-auth:${domain}:${dkimSelector}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Run all checks in parallel
    const [spf, dmarc, dkim] = await Promise.all([
      checkSPF(domain),
      checkDMARC(domain),
      checkDKIM(domain, dkimSelector),
    ]);
    
    // Calculate overall score
    let score = 0;
    if (spf.found && spf.all === "fail") score += 30;
    else if (spf.found && spf.all === "softfail") score += 20;
    else if (spf.found) score += 10;
    
    if (dmarc.found && dmarc.policy === "reject") score += 40;
    else if (dmarc.found && dmarc.policy === "quarantine") score += 30;
    else if (dmarc.found) score += 10;
    
    if (dkim.found && dkim.hasPublicKey) score += 30;
    
    const result = {
      domain,
      spf,
      dmarc,
      dkim,
      score,
      grade: score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : score >= 30 ? "D" : "F",
    };
    
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("Email auth check error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};

