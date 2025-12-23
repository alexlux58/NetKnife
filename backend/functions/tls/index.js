/**
 * ==============================================================================
 * NETKNIFE - TLS CERTIFICATE INSPECTOR LAMBDA FUNCTION
 * ==============================================================================
 * 
 * PURPOSE:
 * This Lambda function inspects TLS certificates for any host/port.
 * It connects to the target, retrieves the certificate chain, and returns
 * detailed information about each certificate.
 * 
 * USE CASES:
 * - Check certificate expiration dates
 * - Verify Subject Alternative Names (SANs)
 * - Inspect certificate chain (leaf → intermediate → root)
 * - Get certificate fingerprints for pinning
 * - Verify signature algorithms and key sizes
 * 
 * HOW IT WORKS:
 * 1. Client sends POST with host, port, and optional SNI
 * 2. Lambda establishes TLS connection (with rejectUnauthorized: false)
 * 3. Retrieves peer certificate and full chain
 * 4. Parses certificate details using Node.js crypto module
 * 5. Returns structured JSON with all certificate info
 * 
 * INPUT FORMAT:
 * {
 *   "host": "example.com",      // Hostname or IP
 *   "port": 443,                // Port number (default: 443)
 *   "sni": "example.com"        // SNI hostname (optional, defaults to host)
 * }
 * 
 * OUTPUT FORMAT:
 * {
 *   "host": "example.com",
 *   "port": 443,
 *   "sni": "example.com",
 *   "days_remaining": 90,       // Days until leaf cert expires
 *   "chain": [
 *     {
 *       "subject": "CN=example.com",
 *       "issuer": "CN=DigiCert...",
 *       "valid_from": "...",
 *       "valid_to": "...",
 *       "serial_number": "...",
 *       "fingerprint_sha256": "AA:BB:CC:...",
 *       "san": ["DNS:example.com", "DNS:www.example.com"],
 *       "signature_algorithm": "sha256WithRSAEncryption",
 *       "public_key_type": "rsa",
 *       "public_key_size": 2048
 *     },
 *     // ... intermediate and root certs
 *   ]
 * }
 * 
 * SECURITY NOTES:
 * - Uses rejectUnauthorized: false to inspect ALL certificates (even invalid)
 * - This is intentional for an inspection tool
 * - Does NOT cache results (certs can change anytime)
 * 
 * ==============================================================================
 */

const tls = require("tls");
const crypto = require("crypto");

// Connection timeout in milliseconds
const CONNECT_TIMEOUT_MS = 10000;

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
 * Computes SHA-256 hash of a buffer and returns hex string
 * 
 * @param {Buffer} buffer - Data to hash
 * @returns {string} Hex-encoded SHA-256 hash
 */
function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Formats a hex string with colons (AA:BB:CC:...)
 * 
 * @param {string} hex - Hex string
 * @returns {string} Colon-separated uppercase hex
 */
function formatFingerprint(hex) {
  return hex.match(/.{1,2}/g).join(":").toUpperCase();
}

/**
 * Extracts Subject Alternative Names from X.509 certificate
 * The subjectAltName string looks like: "DNS:example.com, DNS:www.example.com"
 * 
 * @param {crypto.X509Certificate} x509 - Certificate object
 * @returns {string[]} Array of SAN entries
 */
function extractSAN(x509) {
  const san = x509.subjectAltName || "";
  return san
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Establishes a TLS connection and returns the socket
 * 
 * @param {object} options - Connection options
 * @returns {Promise<tls.TLSSocket>} Connected TLS socket
 */
function connectTLS({ host, port, sni, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: sni || host,  // SNI for virtual hosting
        // IMPORTANT: Set to false to inspect ALL certificates
        // Including expired, self-signed, wrong hostname, etc.
        // This is intentional for an inspection tool!
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      () => {
        // Connection established, TLS handshake complete
        resolve(socket);
      }
    );

    socket.on("error", (err) => reject(err));
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error("Connection timeout"));
    });
  });
}

/**
 * Parses certificate chain into structured objects
 * 
 * @param {object} peerCert - Node.js peer certificate object
 * @returns {object[]} Array of certificate details
 */
function parseChain(peerCert) {
  const chain = [];
  const seen = new Set();  // Prevent infinite loops in malformed chains

  let current = peerCert;
  while (current && current.raw && current.raw.length > 0) {
    // Compute fingerprint to detect loops
    const fingerprint = sha256Hex(current.raw);
    if (seen.has(fingerprint)) break;
    seen.add(fingerprint);

    // Parse with crypto.X509Certificate for structured access
    const x509 = new crypto.X509Certificate(current.raw);

    // Extract certificate details
    chain.push({
      subject: x509.subject,
      issuer: x509.issuer,
      valid_from: x509.validFrom,
      valid_to: x509.validTo,
      serial_number: x509.serialNumber,
      fingerprint_sha256: formatFingerprint(fingerprint),
      san: extractSAN(x509),
      signature_algorithm: x509.signatureAlgorithm,
      public_key_type: x509.publicKey?.asymmetricKeyType || null,
      public_key_size: x509.publicKey?.asymmetricKeyDetails?.modulusLength || 
                       x509.publicKey?.asymmetricKeyDetails?.namedCurve || null,
    });

    // Move to issuer certificate (if different from current)
    if (current.issuerCertificate && current.issuerCertificate !== current) {
      current = current.issuerCertificate;
    } else {
      current = null;
    }
  }

  return chain;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  try {
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    
    // Extract inputs
    const host = String(body.host || "").trim();
    const port = body.port ? Number(body.port) : 443;
    const sni = body.sni ? String(body.sni).trim() : "";

    // Validate host
    if (!host || host.length > 253) {
      return createResponse(400, {
        error: "Invalid host",
        details: "Host must be 1-253 characters",
      });
    }

    // Validate host format (DNS name or IP)
    if (!/^[a-zA-Z0-9.-]+$/.test(host) && !host.includes(":")) {
      return createResponse(400, {
        error: "Invalid host format",
        details: "Host must be a DNS name or IP address",
      });
    }

    // Validate port
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return createResponse(400, {
        error: "Invalid port",
        details: "Port must be 1-65535",
      });
    }

    // Connect and get certificate
    const socket = await connectTLS({
      host,
      port,
      sni: sni || host,
      timeoutMs: CONNECT_TIMEOUT_MS,
    });

    // Get peer certificate with full chain
    const peerCert = socket.getPeerCertificate(true);

    // Clean up connection
    socket.end();
    socket.destroy();

    // Check if certificate was presented
    if (!peerCert || !peerCert.raw) {
      return createResponse(502, {
        error: "No certificate presented",
        details: "Server did not present a TLS certificate",
      });
    }

    // Parse certificate chain
    const chain = parseChain(peerCert);

    // Calculate days remaining for leaf certificate
    const leafValidTo = new Date(chain[0].valid_to).getTime();
    const now = Date.now();
    const daysRemaining = Math.floor((leafValidTo - now) / (1000 * 60 * 60 * 24));

    // Build response
    return createResponse(200, {
      host,
      port,
      sni: sni || host,
      days_remaining: daysRemaining,
      chain,
    });
  } catch (error) {
    console.error("TLS inspection error:", error);

    return createResponse(500, {
      error: "TLS inspection failed",
      details: error.message || "Unknown error",
    });
  }
};

