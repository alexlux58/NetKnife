const { createResponse } = require('netknife-common')
const { resolveAndValidateHost, validateTlsPort } = require('netknife-common/ssrf')

function validateTlsRequest(body) {
  const host = String(body?.host || '').trim()
  const sni = body?.sni ? String(body.sni).trim() : ''
  const portResult = validateTlsPort(body?.port)

  if (!portResult.ok) {
    return { error: createResponse(400, { error: 'Invalid port', details: portResult.error }) }
  }

  return {
    ok: true,
    value: {
      host,
      sni: sni || host,
      port: portResult.value,
    },
  }
}

module.exports = {
  createResponse,
  validateTlsRequest,
  resolveAndValidateHost,
}
