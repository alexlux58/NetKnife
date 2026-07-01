const tls = require('tls')
const crypto = require('crypto')
const { createResponse, validateTlsRequest, resolveAndValidateHost } = require('./validation')

const CONNECT_TIMEOUT_MS = 10000

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function formatFingerprint(hex) {
  return hex.match(/.{1,2}/g).join(':').toUpperCase()
}

function extractSAN(x509) {
  const san = x509.subjectAltName || ''
  return san
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function connectTLS({ host, port, sni, timeoutMs, connectFn }) {
  const connect = connectFn || tls.connect
  return new Promise((resolve, reject) => {
    const socket = connect(
      {
        host,
        port,
        servername: sni || host,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      () => resolve(socket)
    )

    socket.on('error', (err) => reject(err))
    socket.setTimeout(timeoutMs, () => {
      socket.destroy()
      reject(new Error('Connection timeout'))
    })
  })
}

function parseChain(peerCert) {
  const chain = []
  const seen = new Set()

  let current = peerCert
  while (current && current.raw && current.raw.length > 0) {
    const fingerprint = sha256Hex(current.raw)
    if (seen.has(fingerprint)) break
    seen.add(fingerprint)

    const x509 = new crypto.X509Certificate(current.raw)
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
      public_key_size:
        x509.publicKey?.asymmetricKeyDetails?.modulusLength ||
        x509.publicKey?.asymmetricKeyDetails?.namedCurve ||
        null,
    })

    if (current.issuerCertificate && current.issuerCertificate !== current) {
      current = current.issuerCertificate
    } else {
      current = null
    }
  }

  return chain
}

function createHandler(deps = {}) {
  const dnsLookup = deps.dnsLookup
  const connectFn = deps.connectTLS
  const timeoutMs = deps.timeoutMs ?? CONNECT_TIMEOUT_MS

  return async function handler(event) {
    try {
      const body = event.body ? JSON.parse(event.body) : {}
      const request = validateTlsRequest(body)
      if (request.error) return request.error

      const { host, sni, port } = request.value
      const resolved = await resolveAndValidateHost(host, dnsLookup)
      if (!resolved.ok) {
        return createResponse(400, {
          error: 'Invalid host',
          details: resolved.error,
        })
      }

      if (sni !== host) {
        const sniResolved = await resolveAndValidateHost(sni, dnsLookup)
        if (!sniResolved.ok) {
          return createResponse(400, {
            error: 'Invalid SNI',
            details: sniResolved.error,
          })
        }
      }

      const socket = await connectTLS({
        host: resolved.addresses[0],
        port,
        sni,
        timeoutMs,
        connectFn,
      })

      const peerCert = socket.getPeerCertificate(true)
      const protocol = socket.getProtocol() || null
      const cipher = socket.getCipher()
      const cipherString = cipher ? `${cipher.name} (${cipher.version})` : null

      socket.end()
      socket.destroy()

      if (!peerCert || !peerCert.raw) {
        return createResponse(502, {
          error: 'No certificate presented',
          details: 'Server did not present a TLS certificate',
        })
      }

      const chain = parseChain(peerCert)
      const leafValidTo = new Date(chain[0].valid_to).getTime()
      const daysRemaining = Math.floor((leafValidTo - Date.now()) / (1000 * 60 * 60 * 24))

      return createResponse(200, {
        host,
        port,
        sni,
        protocol: protocol || undefined,
        cipher: cipherString || undefined,
        days_remaining: daysRemaining,
        chain,
      })
    } catch (error) {
      console.error('TLS inspection error:', error)
      const msg = error.message || 'Unknown error'
      const safe = msg.startsWith('Blocked destination') || msg === 'Connection timeout'
      return createResponse(500, {
        error: 'TLS inspection failed',
        details: safe ? msg : 'An unexpected error occurred.',
      })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
