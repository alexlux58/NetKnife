const { createResponse } = require('netknife-common')

function json(statusCode, body) {
  return createResponse(statusCode, body, { headerStyle: 'title' })
}

/** Accept an IPv4 (loose) address or anything with a colon (IPv6). */
function isValidIP(ip) {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) || ip.includes(':')
}

/** Basic hostname / domain-name validation. */
function isValidHostname(hostname) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(hostname)
}

/** Check whether an IPv4 address is in a private/reserved range. */
function isPrivateIP(ip) {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^0\./,
  ]
  return privateRanges.some((r) => r.test(ip))
}

/** Build the DynamoDB cache key for a Shodan host lookup (keyed on resolved IP). */
function buildCacheKey(ip) {
  return `shodan-${ip}`
}

module.exports = {
  json,
  isValidIP,
  isValidHostname,
  isPrivateIP,
  buildCacheKey,
}
