const { createResponse } = require('netknife-common')

function json(statusCode, body) {
  return createResponse(statusCode, body, { headerStyle: 'title' })
}

/** Accept an IPv4 address, an IPv4 CIDR, or any IPv6-looking value. */
function isValidQuery(query) {
  // IPv4 address
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(query)) {
    return true
  }
  // IPv4 CIDR
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(query)) {
    return true
  }
  // IPv6 address or CIDR (simplified check)
  if (query.includes(':')) {
    return true
  }
  return false
}

/** Build the DynamoDB cache key for a looking-glass query. */
function buildCacheKey(query) {
  return `bgp-lg-${query}`
}

/**
 * Validate the request query. Returns null when valid, or a ready-to-return
 * API Gateway response describing the problem.
 */
function validateQuery(query) {
  if (!query || typeof query !== 'string' || !isValidQuery(query.trim())) {
    return json(400, { error: 'Invalid query. Must be an IP address or CIDR prefix.' })
  }
  return null
}

module.exports = {
  json,
  isValidQuery,
  buildCacheKey,
  validateQuery,
}
