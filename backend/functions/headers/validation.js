const { createResponse } = require('netknife-common')
const {
  isPrivateIPv4,
  isPrivateIPv6,
  isBlockedIP,
} = require('netknife-common/ssrf')

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
