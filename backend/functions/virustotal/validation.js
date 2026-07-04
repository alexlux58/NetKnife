const { createResponse } = require('netknife-common')

const VT_API_BASE = 'https://www.virustotal.com/api/v3'
const VALID_TYPES = ['ip', 'domain', 'url']

function json(statusCode, body) {
  return createResponse(statusCode, body, { headerStyle: 'title' })
}

/**
 * Validate the request. Returns null when valid, or a ready-to-return
 * API Gateway response describing the problem.
 */
function validateRequest(type, value) {
  if (!type || !value) {
    return json(400, { error: "Missing 'type' or 'value' parameter" })
  }
  if (!VALID_TYPES.includes(type)) {
    return json(400, { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` })
  }
  return null
}

/**
 * Build the VirusTotal API URL + cache key for a validated type/value pair.
 */
function buildTarget(type, value) {
  switch (type) {
    case 'ip':
      return {
        apiUrl: `${VT_API_BASE}/ip_addresses/${encodeURIComponent(value)}`,
        cacheKey: `vt-ip-${value}`,
      }
    case 'domain':
      return {
        apiUrl: `${VT_API_BASE}/domains/${encodeURIComponent(value)}`,
        cacheKey: `vt-domain-${value}`,
      }
    case 'url': {
      // URL needs to be base64url encoded (no padding)
      const urlId = Buffer.from(value).toString('base64').replace(/=/g, '')
      return {
        apiUrl: `${VT_API_BASE}/urls/${urlId}`,
        cacheKey: `vt-url-${urlId}`,
      }
    }
    default:
      return null
  }
}

module.exports = {
  VT_API_BASE,
  VALID_TYPES,
  json,
  validateRequest,
  buildTarget,
}
