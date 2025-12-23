/**
 * ==============================================================================
 * NETKNIFE - BGP LOOKING GLASS TOOL
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'

interface BgpResult {
  query: string
  prefix: string
  originAsns: { asn: number; holder: string }[]
  visibility: {
    v4Visibility: number | null
    v6Visibility: number | null
  }
  routes: {
    rrc: string
    location: string
    peers: { asn: number; prefix: string; asPath: string }[]
  }[]
}

export default function BgpLookingGlassTool() {
  const [query, setQuery] = useState('8.8.8.8')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BgpResult | null>(null)
  const [error, setError] = useState('')

  async function handleLookup() {
    setLoading(true)
    setError('')
    setResult(null)
    
    try {
      const data = await apiPost<BgpResult>('/bgp-looking-glass', { query })
      setResult(data)
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`Error ${e.status}: ${formatJson(e.body)}`)
      } else {
        setError(String(e))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">BGP Looking Glass</h1>
        <p className="text-gray-400 mt-1">
          Query BGP routing information from global route servers
        </p>
      </div>

      <RemoteDisclosure sends={['IP address or CIDR prefix']} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">IP or Prefix</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="8.8.8.8 or 8.8.8.0/24"
              className="input font-mono"
            />
          </div>
          <button onClick={handleLookup} disabled={loading || !query} className="btn btn-primary w-full">
            {loading ? 'Querying...' : 'Query BGP'}
          </button>
        </div>

        <div className="space-y-4">
          {result && (
            <div className="card p-6 space-y-4">
              <div>
                <div className="text-sm text-gray-500">Prefix</div>
                <div className="text-xl font-mono text-blue-400">{result.prefix || result.query}</div>
              </div>
              
              {result.originAsns && result.originAsns.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">Origin ASN</div>
                  {result.originAsns.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono text-emerald-400">AS{o.asn}</span>
                      <span className="text-gray-400">{o.holder}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {result.routes && result.routes.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">AS Paths from Route Collectors</div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {result.routes.slice(0, 10).map((route, i) => (
                      <div key={i} className="p-2 bg-[#161b22] rounded text-sm">
                        <div className="text-gray-400 text-xs mb-1">{route.rrc} - {route.location}</div>
                        {route.peers.slice(0, 3).map((peer, j) => (
                          <div key={j} className="font-mono text-xs text-blue-300">
                            {peer.asPath}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <JsonViewer title="Full Response" json={result} error={error} />
        </div>
      </div>
    </div>
  )
}

