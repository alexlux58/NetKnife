const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')
const { createCacheClient } = require('./cache')

describe('createCacheClient', () => {
  it('reads and writes using the value payload field', async () => {
    const store = new Map()
    const dynamodb = {
      send: async (command) => {
        if (command instanceof GetCommand) {
          const key = command.input.Key.cache_key
          return { Item: store.get(key) || undefined }
        }
        if (command instanceof PutCommand) {
          store.set(command.input.Item.cache_key, command.input.Item)
          return {}
        }
        throw new Error('unexpected command')
      },
    }

    const cache = createCacheClient({
      dynamodb,
      cacheTable: 'cache-table',
      payloadField: 'value',
    })

    await cache.put('dns:A:example.com', { answer: ['1.2.3.4'] }, 60)
    const hit = await cache.get('dns:A:example.com')
    assert.deepEqual(hit, { answer: ['1.2.3.4'] })
    assert.equal(store.get('dns:A:example.com').value.answer[0], '1.2.3.4')
  })

  it('reads and writes using the data payload field', async () => {
    const store = new Map()
    const dynamodb = {
      send: async (command) => {
        if (command instanceof PutCommand) {
          store.set(command.input.Item.cache_key, command.input.Item)
          return {}
        }
        if (command instanceof GetCommand) {
          return { Item: store.get(command.input.Key.cache_key) }
        }
        throw new Error('unexpected command')
      },
    }

    const cache = createCacheClient({
      dynamodb,
      cacheTable: 'cache-table',
      payloadField: 'data',
    })

    await cache.put('ptr:8.8.8.8', { ptr: 'dns.google' }, 60)
    assert.deepEqual(await cache.get('ptr:8.8.8.8'), { ptr: 'dns.google' })
  })

  it('returns null for expired items', async () => {
    const cache = createCacheClient({
      cacheTable: 'cache-table',
      dynamodb: {
        send: async () => ({
          Item: {
            cache_key: 'k',
            data: { stale: true },
            expires_at: Math.floor(Date.now() / 1000) - 1,
          },
        }),
      },
    })

    assert.equal(await cache.get('k'), null)
  })
})
