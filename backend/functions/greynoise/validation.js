const { createResponse } = require('netknife-common')

function json(statusCode, body) {
  return createResponse(statusCode, body, { headerStyle: 'title' })
}

/** Validate an IPv4 address (GreyNoise community API is IPv4-only). */
function isValidIP(ip) {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)
}

/** Check whether an IPv4 address is in a private/reserved range. */
function isPrivateIP(ip) {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
  ]
  return privateRanges.some((r) => r.test(ip))
}

/** Build the DynamoDB cache key for a GreyNoise lookup. */
function buildCacheKey(ip) {
  return `greynoise-${ip}`
}

/**
 * Validate the request IP. Returns null when valid, or a ready-to-return
 * API Gateway response describing the problem.
 */
function validateIp(ip) {
  if (!ip || !isValidIP(ip)) {
    return json(400, { error: 'Invalid IP address. Only IPv4 is supported.' })
  }
  if (isPrivateIP(ip)) {
    return json(400, { error: 'Cannot query private IP addresses' })
  }
  return null
}

module.exports = {
  json,
  isValidIP,
  isPrivateIP,
  buildCacheKey,
  validateIp,
}
