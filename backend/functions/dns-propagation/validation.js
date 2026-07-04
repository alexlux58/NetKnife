const { createResponse } = require('netknife-common')

/** DNS resolvers to query */
const DNS_RESOLVERS = [
  { name: 'Cloudflare', ip: '1.1.1.1', location: 'Global (Anycast)' },
  { name: 'Google', ip: '8.8.8.8', location: 'Global (Anycast)' },
  { name: 'Quad9', ip: '9.9.9.9', location: 'Global (Anycast)' },
  { name: 'OpenDNS', ip: '208.67.222.222', location: 'US (Anycast)' },
  { name: 'Level3', ip: '4.2.2.1', location: 'US' },
  { name: 'Comodo', ip: '8.26.56.26', location: 'US' },
  { name: 'CleanBrowsing', ip: '185.228.168.9', location: 'EU' },
  { name: 'AdGuard', ip: '94.140.14.14', location: 'EU' },
]

const VALID_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'PTR', 'SRV']

function json(statusCode, body) {
  return createResponse(statusCode, body, { headerStyle: 'title' })
}

/**
 * Validate the request. Returns null when valid, or a ready-to-return
 * API Gateway response describing the problem.
 */
function validateRequest(name, type) {
  if (!name || typeof name !== 'string') {
    return json(400, { error: "Missing or invalid 'name' parameter" })
  }
  if (!VALID_TYPES.includes(String(type).toUpperCase())) {
    return json(400, { error: `Invalid record type. Valid types: ${VALID_TYPES.join(', ')}` })
  }
  return null
}

/** Build the DynamoDB cache key for a propagation check. */
function buildCacheKey(name, type) {
  return `dns-prop-${name}-${type}`
}

/**
 * Determine whether the successful resolver answers agree with each other.
 */
function computeConsistency(results) {
  const successfulResults = results.filter((r) => !r.error && r.answers?.length > 0)
  const answerSets = successfulResults.map((r) => r.answers.map((a) => a.data).sort().join(','))
  return answerSets.length > 0 && answerSets.every((s) => s === answerSets[0])
}

module.exports = {
  DNS_RESOLVERS,
  VALID_TYPES,
  json,
  validateRequest,
  buildCacheKey,
  computeConsistency,
}
