/**
 * Standard API Gateway proxy JSON responses.
 * CORS preflight is handled by API Gateway; Lambdas only set content/cache headers.
 */

function createResponse(statusCode, body, options = {}) {
  const headerStyle = options.headerStyle || 'lowercase'

  const headers = headerStyle === 'title'
    ? {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }
    : {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      }

  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  }
}

module.exports = {
  createResponse,
}
