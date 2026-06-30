const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { createResponse } = require('./http')

describe('createResponse', () => {
  it('returns lowercase headers by default', () => {
    const res = createResponse(200, { ok: true })
    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['content-type'], 'application/json')
    assert.equal(res.headers['cache-control'], 'no-store')
    assert.deepEqual(JSON.parse(res.body), { ok: true })
  })

  it('supports title-case headers', () => {
    const res = createResponse(400, { error: 'bad' }, { headerStyle: 'title' })
    assert.equal(res.headers['Content-Type'], 'application/json')
    assert.equal(res.headers['Cache-Control'], 'no-store')
  })
})
