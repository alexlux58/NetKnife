const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')
const { validateTracerouteTarget, isBlockedIP } = require('./validation')

const CACHE_TABLE = process.env.CACHE_TABLE
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || '600')

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  }
}

function createHandler(deps = {}) {
  const ddb = deps.ddb || DynamoDBDocumentClient.from(deps.ddbClient || new DynamoDBClient({}))
  const fetchFn = deps.fetch || fetch
  const cacheTable = deps.cacheTable ?? CACHE_TABLE
  const ttlSeconds = deps.ttlSeconds ?? TTL_SECONDS

  async function cacheGet(key) {
    if (!cacheTable) return null
    try {
      const result = await ddb.send(new GetCommand({
        TableName: cacheTable,
        Key: { cache_key: key },
      }))
      if (result.Item && result.Item.expires_at > Math.floor(Date.now() / 1000)) {
        return result.Item.data
      }
    } catch (e) {
      console.error('Cache get error:', e)
    }
    return null
  }

  async function cachePut(key, data, ttl) {
    if (!cacheTable) return
    try {
      await ddb.send(new PutCommand({
        TableName: cacheTable,
        Item: {
          cache_key: key,
          data,
          expires_at: Math.floor(Date.now() / 1000) + ttl,
        },
      }))
    } catch (e) {
      console.error('Cache put error:', e)
    }
  }

  async function fetchWithTimeout(url, timeout = 15000, options = {}) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetchFn(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'NetKnife/1.0',
          ...(options.headers || {}),
        },
      })
      clearTimeout(timeoutId)
      return response
    } catch (e) {
      clearTimeout(timeoutId)
      if (e.name === 'AbortError') throw new Error('Request timeout')
      throw e
    }
  }

  return async function handler(event) {
    let body
    try {
      body = JSON.parse(event.body)
    } catch (e) {
      return json(400, { error: 'Invalid JSON body' })
    }

    const validated = validateTracerouteTarget(body?.target)
    if (!validated.ok) {
      return json(400, { error: validated.error })
    }

    const cleanTarget = validated.value
    const cacheKey = `traceroute-${cleanTarget}`
    const cached = await cacheGet(cacheKey)
    if (cached) {
      return json(200, { ...cached, cached: true })
    }

    try {
      let targetIP = cleanTarget
      if (validated.kind === 'hostname') {
        const dnsResponse = await fetchWithTimeout(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanTarget)}&type=A`,
          10000,
          { headers: { Accept: 'application/dns-json' } }
        )

        if (!dnsResponse.ok) {
          return json(502, { error: 'DNS resolution failed', details: `HTTP ${dnsResponse.status}` })
        }

        const dnsData = await dnsResponse.json()
        if (!dnsData.Answer || dnsData.Answer.length === 0) {
          return json(400, { error: 'Could not resolve hostname to IP address' })
        }

        targetIP = dnsData.Answer[0].data
      }

      if (isBlockedIP(targetIP)) {
        return json(400, { error: 'Cannot trace to private/reserved IP addresses.' })
      }

      const [lookingGlassResponse, geoDataResponse] = await Promise.all([
        fetchWithTimeout(`https://stat.ripe.net/data/looking-glass/data.json?resource=${encodeURIComponent(targetIP)}`, 15000),
        fetchWithTimeout(`https://stat.ripe.net/data/geoloc/data.json?resource=${encodeURIComponent(targetIP)}`, 15000),
      ])

      if (!lookingGlassResponse.ok) {
        return json(502, {
          error: 'RIPEstat API error',
          details: `Looking glass API returned ${lookingGlassResponse.status}`,
        })
      }

      const lookingGlass = await lookingGlassResponse.json()
      const geoData = await geoDataResponse.json()

      let asPath = []
      const rrcs = lookingGlass.data?.rrcs || []
      for (const rrc of rrcs) {
        if (rrc.peers && rrc.peers.length > 0) {
          const peer = rrc.peers[0]
          if (peer.as_path) {
            asPath = peer.as_path.split(' ').map((a) => parseInt(a, 10)).filter((a) => !Number.isNaN(a))
            break
          }
        }
      }

      const asPathLimited = asPath.slice(0, 20)
      const hops = await Promise.all(asPathLimited.map(async (asn, index) => ({
        hop: index + 1,
        asn,
        name: `AS${asn}`,
        description: null,
        countryCode: null,
      })))

      const geoLocations = geoData.data?.locations || []
      const targetGeo = geoLocations.length > 0 ? {
        city: geoLocations[0].city,
        country: geoLocations[0].country,
        latitude: geoLocations[0].latitude,
        longitude: geoLocations[0].longitude,
      } : null

      const result = {
        target: cleanTarget,
        resolvedIP: targetIP,
        type: 'AS Path Trace',
        note: 'This is a BGP-based AS path trace, not a traditional ICMP traceroute. It shows the autonomous systems along the routing path, not individual routers.',
        hops,
        hopCount: hops.length,
        originASN: hops.length > 0 ? hops[hops.length - 1].asn : null,
        targetGeolocation: targetGeo,
        queriedAt: new Date().toISOString(),
      }

      await cachePut(cacheKey, result, ttlSeconds)
      return json(200, { ...result, cached: false })
    } catch (e) {
      console.error('Traceroute error:', e)
      let errorMessage = e.message || 'Unknown error'
      if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
        errorMessage = 'Request timed out. The target may be unreachable or the API may be slow.'
      } else if (errorMessage.includes('fetch')) {
        errorMessage = 'Network error connecting to external APIs.'
      }
      return json(500, {
        error: 'Traceroute failed',
        details: errorMessage,
        hint: 'This tool uses external APIs (RIPEstat, BGPView). If the error persists, the APIs may be temporarily unavailable.',
      })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
