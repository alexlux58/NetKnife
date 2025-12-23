/**
 * ==============================================================================
 * NETKNIFE - HTTP HEADERS SCANNER LAMBDA FUNCTION
 * ==============================================================================
 * 
 * PURPOSE:
 * This Lambda function scans a URL for HTTP security headers.
 * It evaluates the presence and configuration of security headers
 * that protect against common web vulnerabilities.
 * 
 * SECURITY HEADERS CHECKED:
 * - Strict-Transport-Security (HSTS) - Forces HTTPS
 * - Content-Security-Policy (CSP) - Prevents XSS and injection
 * - X-Frame-Options - Prevents clickjacking
 * - X-Content-Type-Options - Prevents MIME sniffing
 * - Referrer-Policy - Controls referrer information
 * - Permissions-Policy - Controls browser features
 * - Cross-Origin-Opener-Policy (COOP) - Isolates browsing context
 * - Cross-Origin-Embedder-Policy (COEP) - Controls embedding
 * - Cross-Origin-Resource-Policy (CORP) - Controls resource sharing
 * 
 * SSRF PROTECTION:
 * This endpoint could be abused for SSRF (Server-Side Request Forgery).
 * We implement multiple layers of protection:
 * 
 * 1. Protocol restriction: Only http:// and https://
 * 2. Port restriction: Only ports 80 and 443
 * 3. DNS resolution + IP validation: Block private/reserved ranges
 * 4. Redirect limit: Maximum 5 redirects
 * 5. Host re-validation on each redirect
 * 6. Timeout: 5 seconds per request
 * 7. Body discarded immediately (headers only)
 * 
 * INPUT FORMAT:
 * {
 *   "url": "https://example.com"
 * }
 * 
 * OUTPUT FORMAT:
 * {
 *   "input": "https://example.com",
 *   "final_url": "https://example.com/",
 *   "redirects": 0,
 *   "chain": [{
 *     "url": "https://example.com/",
 *     "status": 200,
 *     "security_headers": {
 *       "present": { "strict-transport-security": "max-age=..." },
 *       "missing": ["content-security-policy", ...]
 *     },
 *     "headers": { ... }
 *   }]
 * }
 * 
 * ==============================================================================
 */

const dns = require("dns").promises;
const net = require("net");

// Request timeout in milliseconds
const REQUEST_TIMEOUT_MS = 5000;

// Maximum number of redirects to follow
const MAX_REDIRECTS = 5;

// Security headers to check
const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
];

/**
 * Creates a standardized API Gateway response
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

/**
 * Checks if an IPv4 address is in a private/reserved range
 * These should never be accessed from our Lambda (SSRF protection)
 * 
 * @param {string} ip - IPv4 address
 * @returns {boolean} True if private/reserved
 */
function isPrivateIPv4(ip) {
  const parts = ip.split(".").map((x) => Number(x));
  if (parts.length !== 4) return true;
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;

  const [a, b] = parts;

  // Loopback: 127.0.0.0/8
  if (a === 127) return true;
  
  // "This" network: 0.0.0.0/8
  if (a === 0) return true;
  
  // Private Class A: 10.0.0.0/8
  if (a === 10) return true;
  
  // Private Class B: 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  
  // Private Class C: 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  
  // Link-local: 169.254.0.0/16
  if (a === 169 && b === 254) return true;
  
  // CGNAT: 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return true;
  
  // Benchmark: 198.18.0.0/15
  if (a === 198 && (b === 18 || b === 19)) return true;
  
  // Multicast + Reserved: 224.0.0.0+
  if (a >= 224) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in a private/reserved range
 * 
 * @param {string} ip - IPv6 address
 * @returns {boolean} True if private/reserved
 */
function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();
  
  // Loopback: ::1
  if (normalized === "::1" || normalized === "::") return true;
  
  // Link-local: fe80::/10
  if (normalized.startsWith("fe80:")) return true;
  
  // Unique local: fc00::/7 (fc00:: and fd00::)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  
  // Multicast: ff00::/8
  if (normalized.startsWith("ff")) return true;

  return false;
}

/**
 * Checks if an IP address is blocked (private/reserved)
 * 
 * @param {string} ip - IP address (v4 or v6)
 * @returns {boolean} True if blocked
 */
function isBlockedIP(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;  // Block if not valid IP
}

/**
 * Resolves hostname and validates all resulting IPs
 * Throws if any resolved IP is in a blocked range
 * 
 * @param {string} hostname - Hostname to resolve
 * @returns {string[]} Array of resolved IP addresses
 */
async function resolveAndValidate(hostname) {
  const results = await dns.lookup(hostname, { all: true });
  
  if (!results || results.length === 0) {
    throw new Error("DNS resolution failed");
  }

  for (const result of results) {
    if (isBlockedIP(result.address)) {
      throw new Error(`Blocked destination: ${result.address} (private/reserved IP)`);
    }
  }

  return results.map((r) => r.address);
}

/**
 * Analyzes response headers for security headers
 * 
 * @param {Headers} headers - Fetch API Headers object
 * @returns {object} { present: {}, missing: [] }
 */
function analyzeSecurityHeaders(headers) {
  const present = {};
  const missing = [];

  for (const header of SECURITY_HEADERS) {
    const value = headers.get(header);
    if (value) {
      present[header] = value;
    } else {
      missing.push(header);
    }
  }

  return { present, missing };
}

/**
 * Fetches headers for a single URL (no redirect following)
 * 
 * @param {string} url - URL to fetch
 * @returns {object} { status, location, headers }
 */
async function fetchHeadersOnce(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",  // Don't follow redirects automatically
      signal: controller.signal,
      headers: {
        "user-agent": "NetKnife/1.0 SecurityHeadersScanner",
        "accept": "*/*",
      },
    });

    // Cancel response body immediately (we only want headers)
    try {
      response.body?.cancel();
    } catch {
      // Ignore errors cancelling body
    }

    // Convert headers to plain object
    const headersObj = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    return {
      status: response.status,
      location: response.headers.get("location"),
      headers: headersObj,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  try {
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    
    // Extract and validate URL
    const inputUrl = String(body.url || "").trim();
    
    if (!inputUrl || inputUrl.length > 2048) {
      return createResponse(400, {
        error: "Invalid URL",
        details: "URL must be 1-2048 characters",
      });
    }

    // Parse URL
    let parsedUrl;
    try {
      parsedUrl = new URL(inputUrl);
    } catch {
      return createResponse(400, {
        error: "Malformed URL",
        details: "Could not parse URL",
      });
    }

    // Validate protocol (SSRF protection)
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return createResponse(400, {
        error: "Invalid protocol",
        details: "Only http:// and https:// are allowed",
      });
    }

    // Validate port (SSRF protection)
    const port = parsedUrl.port
      ? Number(parsedUrl.port)
      : parsedUrl.protocol === "https:"
      ? 443
      : 80;
    
    if (![80, 443].includes(port)) {
      return createResponse(400, {
        error: "Invalid port",
        details: "Only ports 80 and 443 are allowed",
      });
    }

    // Resolve and validate initial hostname (SSRF protection)
    await resolveAndValidate(parsedUrl.hostname);

    // Follow redirects and collect chain
    const chain = [];
    let currentUrl = parsedUrl.toString();

    for (let i = 0; i < MAX_REDIRECTS; i++) {
      // Parse current URL
      const curParsed = new URL(currentUrl);
      
      // Validate protocol on each hop
      if (!["http:", "https:"].includes(curParsed.protocol)) {
        throw new Error("Redirect to invalid protocol");
      }
      
      // Validate port on each hop
      const hopPort = curParsed.port
        ? Number(curParsed.port)
        : curParsed.protocol === "https:"
        ? 443
        : 80;
      
      if (![80, 443].includes(hopPort)) {
        throw new Error("Redirect to invalid port");
      }
      
      // Resolve and validate hostname on each hop
      await resolveAndValidate(curParsed.hostname);

      // Fetch headers
      const result = await fetchHeadersOnce(currentUrl);
      
      // Analyze security headers
      const securityAnalysis = analyzeSecurityHeaders(
        new Map(Object.entries(result.headers))
      );

      // Add to chain
      chain.push({
        url: currentUrl,
        status: result.status,
        location: result.location,
        security_headers: securityAnalysis,
        headers: result.headers,
      });

      // Check for redirect
      if (result.status >= 300 && result.status < 400 && result.location) {
        currentUrl = new URL(result.location, currentUrl).toString();
        continue;
      }

      // No more redirects - return result
      return createResponse(200, {
        input: inputUrl,
        final_url: currentUrl,
        redirects: chain.length - 1,
        chain,
      });
    }

    // Too many redirects
    return createResponse(400, {
      error: "Too many redirects",
      details: `Exceeded maximum of ${MAX_REDIRECTS} redirects`,
      chain,
    });
  } catch (error) {
    console.error("Headers scan error:", error);

    return createResponse(500, {
      error: "Headers scan failed",
      details: error.message || "Unknown error",
    });
  }
};

