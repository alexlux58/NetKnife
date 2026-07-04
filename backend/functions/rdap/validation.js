const { createResponse } = require('netknife-common')
const {
  validateRdapQuery,
  isAllowedRdapHost,
  ALLOWED_RDAP_HOSTS,
  buildRdapUrl,
} = require('netknife-common/ssrf')

const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 8000

module.exports = {
  createResponse,
  validateRdapQuery,
  isAllowedRdapHost,
  ALLOWED_RDAP_HOSTS,
  MAX_REDIRECTS,
  buildRdapUrl,
}
