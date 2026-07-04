const { createResponse } = require('netknife-common')

/**
 * Validate an IPv4 or (simplified) IPv6 address.
 * Mirrors the original inline validation so behavior is unchanged.
 */
function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number)
    return parts.every((p) => p >= 0 && p <= 255)
  }

  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
  return ipv6Regex.test(ip)
}

/** Normalize the request body into a trimmed IP string. */
function normalizeIpRequest(body) {
  return String((body && body.ip) || '').trim()
}

/** Build the DynamoDB cache key for an IP lookup. */
function buildCacheKey(ip) {
  return `ipapi:${ip}`
}

/**
 * Validate the request. Returns null when valid, or a ready-to-return
 * API Gateway response describing the problem.
 */
function validateIpRequest(ip) {
  if (!ip) {
    return createResponse(400, { error: 'Missing required field: ip' }, { headerStyle: 'title' })
  }
  if (!isValidIP(ip)) {
    return createResponse(400, { error: 'Invalid IP address format' }, { headerStyle: 'title' })
  }
  return null
}

module.exports = {
  isValidIP,
  normalizeIpRequest,
  buildCacheKey,
  validateIpRequest,
}
