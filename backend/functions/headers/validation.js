const net = require('net')
const { createResponse } = require('netknife-common')

const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
]

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map((x) => Number(x))
  if (parts.length !== 4) return true
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true

  const [a, b] = parts

  if (a === 127) return true
  if (a === 0) return true
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true

  return false
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase()

  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('fe80:')) return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (normalized.startsWith('ff')) return true

  return false
}

function isBlockedIP(ip) {
  const version = net.isIP(ip)
  if (version === 4) return isPrivateIPv4(ip)
  if (version === 6) return isPrivateIPv6(ip)
  return true
}

function analyzeSecurityHeaders(headers) {
  const present = {}
  const missing = []

  for (const header of SECURITY_HEADERS) {
    const value = headers.get(header)
    if (value) {
      present[header] = value
    } else {
      missing.push(header)
    }
  }

  return { present, missing }
}

function validateScanUrl(inputUrl) {
  if (!inputUrl || inputUrl.length > 2048) {
    return {
      error: createResponse(400, {
        error: 'Invalid URL',
        details: 'URL must be 1-2048 characters',
      }),
    }
  }

  let parsedUrl
  try {
    parsedUrl = new URL(inputUrl)
  } catch {
    return {
      error: createResponse(400, {
        error: 'Malformed URL',
        details: 'Could not parse URL',
      }),
    }
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return {
      error: createResponse(400, {
        error: 'Invalid protocol',
        details: 'Only http:// and https:// are allowed',
      }),
    }
  }

  const port = parsedUrl.port
    ? Number(parsedUrl.port)
    : parsedUrl.protocol === 'https:'
      ? 443
      : 80

  if (![80, 443].includes(port)) {
    return {
      error: createResponse(400, {
        error: 'Invalid port',
        details: 'Only ports 80 and 443 are allowed',
      }),
    }
  }

  return { parsedUrl }
}

module.exports = {
  SECURITY_HEADERS,
  createResponse,
  isPrivateIPv4,
  isPrivateIPv6,
  isBlockedIP,
  analyzeSecurityHeaders,
  validateScanUrl,
}
