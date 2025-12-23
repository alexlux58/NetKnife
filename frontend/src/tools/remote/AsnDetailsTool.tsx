/**
 * ==============================================================================
 * NETKNIFE - ASN DETAILS TOOL
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'

interface AsnResult {
  asn: number
  name: string
  description: string
  country: string
  rir: string
  rirAllocationDate: string
  website: string
  prefixes: {
    ipv4Count: number
    ipv6Count: number
    ipv4: { prefix: string; name: string }[]
    ipv6: { prefix: string; name: string }[]
  }
  peers: {
    upstreamCount: number
    downstreamCount: number
    upstreams: { asn: number; name: string }[]
    downstreams: { asn: number; name: string }[]
  }
}

export default function AsnDetailsTool() {
  const [asnInput, setAsnInput] = useState('13335')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AsnResult | null>(null)
  const [error, setError] = useState('')

  async function handleLookup() {
    setLoading(true)
    setError('')
    setResult(null)
    
    try {
      const data = await apiPost<AsnResult>('/asn-details', { asn: asnInput })
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
        <h1 className="text-2xl font-bold">ASN Details</h1>
        <p className="text-gray-400 mt-1">
          Autonomous System information, prefixes, and peers
        </p>
      </div>

      <RemoteDisclosure sends={['ASN number']} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">ASN</label>
            <input
              type="text"
              value={asnInput}
              onChange={(e) => setAsnInput(e.target.value)}
              placeholder="13335 or AS13335"
              className="input font-mono"
            />
          </div>
          <button onClick={handleLookup} disabled={loading || !asnInput} className="btn btn-primary w-full">
            {loading ? 'Looking up...' : 'Lookup ASN'}
          </button>
          
          <div className="text-sm text-gray-500">
            <div className="font-medium text-gray-400 mb-2">Common ASNs:</div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { asn: '13335', name: 'Cloudflare' },
                { asn: '15169', name: 'Google' },
                { asn: '16509', name: 'Amazon' },
                { asn: '8075', name: 'Microsoft' },
                { asn: '32934', name: 'Meta' },
                { asn: '20940', name: 'Akamai' },
              ].map(a => (
                <button
                  key={a.asn}
                  onClick={() => setAsnInput(a.asn)}
                  className="text-left px-2 py-1 rounded hover:bg-[#21262d] text-xs"
                >
                  <span className="text-blue-400">{a.asn}</span> - {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {result && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-blue-400">AS{result.asn}</div>
                <span className="px-2 py-1 bg-[#21262d] rounded text-sm">{result.country}</span>
              </div>
              <div>
                <div className="text-lg font-medium">{result.name}</div>
                <div className="text-gray-400">{result.description}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">IPv4 Prefixes</div>
                  <div className="text-xl font-bold text-emerald-400">{result.prefixes.ipv4Count}</div>
                </div>
                <div>
                  <div className="text-gray-500">IPv6 Prefixes</div>
                  <div className="text-xl font-bold text-purple-400">{result.prefixes.ipv6Count}</div>
                </div>
                <div>
                  <div className="text-gray-500">Upstreams</div>
                  <div className="text-xl font-bold">{result.peers.upstreamCount}</div>
                </div>
                <div>
                  <div className="text-gray-500">Downstreams</div>
                  <div className="text-xl font-bold">{result.peers.downstreamCount}</div>
                </div>
              </div>
              
              {result.website && (
                <a href={result.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm">
                  {result.website}
                </a>
              )}
            </div>
          )}

          <JsonViewer title="Full Details" json={result} error={error} />
        </div>
      </div>
    </div>
  )
}

