/**
 * ==============================================================================
 * NETKNIFE - TRACEROUTE TOOL
 * ==============================================================================
 */

import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'
import { useToolState } from '../../lib/useToolState'

interface TracerouteResult {
  target: string
  resolvedIP: string
  type: string
  note: string
  hops: {
    hop: number
    asn: number
    name: string
    description?: string
    countryCode?: string
  }[]
  hopCount: number
  originASN: number
  targetGeolocation?: {
    city: string
    country: string
  }
}

export default function TracerouteTool() {
  const [state, setState] = useToolState(
    'traceroute',
    { target: 'google.com', loading: false, result: null as TracerouteResult | null, error: '' },
    { exclude: ['result'] }
  )
  const { target, loading, result, error } = state

  async function handleTrace() {
    setState({ loading: true, error: '', result: null })
    try {
      const data = await apiPost<TracerouteResult>('/traceroute', { target })
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
        <h1 className="text-2xl font-bold">AS Path Trace</h1>
        <p className="text-gray-400 mt-1">
          BGP-based AS path analysis (not ICMP traceroute)
        </p>
      </div>

      <RemoteDisclosure 
        sends={['Target IP or hostname']} 
        notes="This shows the BGP AS path, not individual router hops."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Target</label>
            <input
              type="text"
              value={target}
              onChange={(e) => setState({ target: e.target.value })}
              placeholder="IP or hostname"
              className="input"
            />
          </div>
          <button onClick={handleTrace} disabled={loading || !target} className="btn btn-primary w-full">
            {loading ? 'Tracing...' : 'Trace Route'}
          </button>
        </div>

        <div className="space-y-4">
          {result && (
            <>
              {/* Add to Report Button */}
              <div className="flex items-center justify-end">
                <AddToReportButton
                  toolId="traceroute"
                  input={target}
                  data={result}
                  category="Network Intelligence"
                />
              </div>
              <div className="card p-6">
              <div className="mb-4">
                <div className="text-sm text-gray-500">Target</div>
                <div className="font-mono text-blue-400">{result.target}</div>
                {result.resolvedIP !== result.target && (
                  <div className="text-sm text-gray-500">Resolved: {result.resolvedIP}</div>
                )}
              </div>
              
              {result.note && (
                <div className="text-xs text-yellow-400 bg-yellow-400/10 p-2 rounded mb-4">
                  ℹ️ {result.note}
                </div>
              )}
              
              <div className="text-sm text-gray-500 mb-2">AS Path ({result.hopCount} hops)</div>
              <div className="space-y-2">
                {result.hops.map((hop, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-[#161b22] rounded">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs">
                      {hop.hop}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400">AS{hop.asn}</span>
                        {hop.countryCode && (
                          <span className="text-xs text-gray-500">{hop.countryCode}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">{hop.name}</div>
                    </div>
                    {i < result.hops.length - 1 && (
                      <span className="text-gray-600">→</span>
                    )}
                  </div>
                ))}
              </div>
              
              {result.targetGeolocation && (
                <div className="mt-4 text-sm text-gray-500">
                  📍 {result.targetGeolocation.city}, {result.targetGeolocation.country}
                </div>
              )}
              </div>
            </>
          )}

          <JsonViewer title="Raw Response" json={result} error={error} />
        </div>
      </div>
    </div>
  )
}

