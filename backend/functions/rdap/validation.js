const { createResponse } = require('netknife-common')
const {
  validateRdapQuery,
  isAllowedRdapHost,
  ALLOWED_RDAP_HOSTS,
} = require('netknife-common/ssrf')

const MAX_REDIRECTS = 5

function buildRdapUrl(query, kind) {
  if (kind === 'domain') {
    return `https://rdap.org/domain/${encodeURIComponent(query)}`
  }
  return `https://rdap.org/ip/${encodeURIComponent(query)}`
}

module.exports = {
  createResponse,
  validateRdapQuery,
  isAllowedRdapHost,
  ALLOWED_RDAP_HOSTS,
  MAX_REDIRECTS,
  buildRdapUrl,
}
