const { createResponse } = require('netknife-common')

const ALLOWED_TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV'])

function isValidDomain(name) {
  if (!name || typeof name !== 'string') return false
  if (name.length > 253) return false
  return /^[a-zA-Z0-9.-]+$/.test(name)
}

function normalizeDnsRequest(body) {
  const name = String(body.name || '').trim().toLowerCase()
  const type = String(body.type || 'A').trim().toUpperCase()
  return { name, type }
}

function validateDnsRequest(name, type) {
  if (!isValidDomain(name)) {
    return {
      statusCode: 400,
      body: {
        error: 'Invalid domain name',
        details: 'Domain must be 1-253 characters, alphanumeric with dots and hyphens',
      },
    }
  }

  if (!ALLOWED_TYPES.has(type)) {
    return {
      statusCode: 400,
      body: {
        error: 'Unsupported record type',
        allowed: Array.from(ALLOWED_TYPES),
      },
    }
  }

  return null
}

function buildCacheKey(type, name) {
  return `dns:${type}:${name}`
}

module.exports = {
  ALLOWED_TYPES,
  createResponse,
  isValidDomain,
  normalizeDnsRequest,
  validateDnsRequest,
  buildCacheKey,
}
