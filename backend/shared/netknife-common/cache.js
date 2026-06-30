const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')

const defaultDdb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

/**
 * DynamoDB cache table helpers (cache_key + expires_at TTL).
 * Supports legacy payload fields: `data` (most functions) or `value` (dns, rdap).
 */
function createCacheClient(options = {}) {
  const {
    dynamodb = defaultDdb,
    cacheTable = process.env.CACHE_TABLE,
    payloadField = 'data',
    logReadError = (error) => console.error('Cache read error:', error),
    logWriteError = (error) => console.error('Cache write error:', error),
  } = options

  async function get(cacheKey) {
    if (!cacheTable) return null

    try {
      const result = await dynamodb.send(new GetCommand({
        TableName: cacheTable,
        Key: { cache_key: cacheKey },
      }))

      if (!result.Item) return null

      const now = Math.floor(Date.now() / 1000)
      if (result.Item.expires_at <= now) return null

      return result.Item[payloadField]
    } catch (error) {
      logReadError(error)
      return null
    }
  }

  async function put(cacheKey, value, ttlSeconds) {
    if (!cacheTable) return

    try {
      await dynamodb.send(new PutCommand({
        TableName: cacheTable,
        Item: {
          cache_key: cacheKey,
          [payloadField]: value,
          expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
        },
      }))
    } catch (error) {
      logWriteError(error)
    }
  }

  return { get, put }
}

module.exports = {
  createCacheClient,
}
