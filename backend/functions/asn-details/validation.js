const { createResponse } = require('netknife-common')

/** Parse an ASN from input (handles "AS13335", "13335", etc.). Returns null if invalid. */
function parseAsn(input) {
  const match = String(input).match(/^(?:AS)?(\d+)$/i)
  return match ? parseInt(match[1], 10) : null
}

/** Build the DynamoDB cache key for an ASN lookup. */
function buildCacheKey(asn) {
  return `asn-${asn}`
}

/**
 * Validate the parsed ASN. Returns null when valid, or a ready-to-return
 * API Gateway response describing the problem.
 */
function validateAsn(asn) {
  if (!asn || asn < 1 || asn > 4294967295) {
    return createResponse(
      400,
      { error: 'Invalid ASN. Must be a number between 1 and 4294967295.' },
      { headerStyle: 'title' },
    )
  }
  return null
}

module.exports = {
  parseAsn,
  buildCacheKey,
  validateAsn,
}
