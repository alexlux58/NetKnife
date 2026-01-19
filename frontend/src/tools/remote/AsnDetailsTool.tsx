/**
 * ==============================================================================
 * NETKNIFE - ASN DETAILS TOOL
 * ==============================================================================
 */

import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'
import { useToolState } from '../../lib/useToolState'

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
  const [state, setState] = useToolState(
    'asn-details',
    { asnInput: '13335', loading: false, result: null as AsnResult | null, error: '' },
    { exclude: ['result'] }
  )
  const { asnInput, loading, result, error } = state

  async function handleLookup() {
    setState({ loading: true, error: '', result: null })
    try {
      const data = await apiPost<AsnResult>('/asn-details', { asn: asnInput })
      setState({ result: data, loading: false })
    } catch (e) {
      if (e instanceof ApiError) {
        setState({ error: `Error ${e.status}: ${formatJson(e.body)}`, loading: false })
      } else {
        setState({ error: String(e), loading: false })
      }
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
              onChange={(e) => setState({ asnInput: e.target.value })}
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
                  onClick={() => setState({ asnInput: a.asn })}
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
            <>
              {/* Add to Report Button */}
              <div className="flex items-center justify-end">
                <AddToReportButton
                  toolId="asn-details"
                  input={asnInput}
                  data={result}
                  category="Network Intelligence"
                />
              </div>
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
            </>
          )}

          <JsonViewer title="Full Details" json={result} error={error} />
        </div>
      </div>
    </div>
  )
}

