const { createResponse } = require('netknife-common')

function json(statusCode, body) {
  return createResponse(statusCode, body)
}

// Allowed resource types (whitelist for security)
const ALLOWED_RESOURCES = new Set(['net', 'org', 'ix', 'fac'])

/**
 * Validates and sanitizes a string parameter.
 * Returns empty string if invalid. Allows alphanumerics, spaces, dots,
 * hyphens, and underscores.
 */
function sanitizeParam(value) {
  if (!value || typeof value !== 'string') return ''
  return value.trim().replace(/[^a-zA-Z0-9\s.\-_]/g, '')
}

/** Validates ASN format (numeric, up to 10 digits). Returns cleaned string or ''. */
function validateAsn(asn) {
  if (!asn) return ''
  const cleaned = String(asn).replace(/[^0-9]/g, '')
  if (cleaned.length > 10) return ''
  return cleaned
}

/**
 * Parse and validate a PeeringDB request body.
 * Returns { error } (a ready-to-return response) on failure, or
 * { resource, asn, name, queryString, cacheKey } on success.
 */
function parseRequest(raw) {
  const resource = String(raw.resource || '').trim().toLowerCase()
  const asn = validateAsn(raw.asn)
  const name = sanitizeParam(raw.name)

  if (!ALLOWED_RESOURCES.has(resource)) {
    return { error: json(400, { error: 'Invalid resource type. Must be one of: net, org, ix, fac' }) }
  }

  if (!asn && !name) {
    return { error: json(400, { error: "At least one of 'asn' or 'name' is required" }) }
  }

  const queryParams = []
  if (asn) queryParams.push(`asn=${encodeURIComponent(asn)}`)
  // PeeringDB uses __icontains for case-insensitive partial match
  if (name) queryParams.push(`name__icontains=${encodeURIComponent(name)}`)
  const queryString = queryParams.join('&')

  return {
    resource,
    asn,
    name,
    queryString,
    cacheKey: `peeringdb:${resource}:${queryString}`,
  }
}

module.exports = {
  json,
  ALLOWED_RESOURCES,
  sanitizeParam,
  validateAsn,
  parseRequest,
}
