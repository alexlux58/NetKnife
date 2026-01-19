/**
 * ==============================================================================
 * NETKNIFE - DNS LOOKUP TOOL
 * ==============================================================================
 * 
 * Performs DNS lookups using DNS-over-HTTPS via the backend Lambda.
 * 
 * FEATURES:
 * - Multiple record types (A, AAAA, CNAME, MX, TXT, NS, SRV)
 * - Cloudflare DoH backend (1.1.1.1)
 * - Cached results for performance
 * - Full DNS response details
 * 
 * NOTE: This is a REMOTE tool - data is sent to AWS Lambda.
 * ==============================================================================
 */

import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { useToolState } from '../../lib/useToolState'

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV']

interface DnsRecord {
  name: string
  type: number
  TTL: number
  data: string
}

interface DnsResult {
  name: string
  type: string
  status: number
  answer: DnsRecord[]
  authority: unknown[]
  cached: boolean
}

export default function DnsTool() {
  const [state, setState] = useToolState(
    'dns',
    { name: 'example.com', type: 'A', loading: false, result: null as DnsResult | null, error: '' },
    { exclude: ['result', 'loading', 'error'] }
  )
  const { name, type, loading, result, error } = state

  async function handleLookup() {
    setState({ loading: true, error: '', result: null })
    try {
      const res = await apiPost<DnsResult>('/dns', { name, type })
      setState({ result: res, loading: false })
    } catch (e) {
      if (e instanceof ApiError) {
        setState({ error: `Error ${e.status}: ${JSON.stringify(e.body, null, 2)}`, loading: false })
      } else {
        setState({ error: String(e), loading: false })
      }
    }
  }

  function loadExample() {
    setState({ name: 'cloudflare.com', type: 'A' })
  }

  return (
    <div className="space-y-6">
      {/* Remote disclosure */}
      <RemoteDisclosure
        sends={['Domain name', 'Record type']}
        notes="Results are cached for 5 minutes. Uses Cloudflare DoH (1.1.1.1)."
      />

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          {/* Domain input */}
          <div>
            <label className="block text-sm font-medium mb-2">Domain Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setState({ name: e.target.value })}
              placeholder="example.com"
              className="input font-mono"
            />
          </div>

          {/* Record type */}
          <div>
            <label className="block text-sm font-medium mb-2">Record Type</label>
            <div className="flex flex-wrap gap-2">
              {RECORD_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setState({ type: t })}
                  className={type === t ? 'btn-primary py-1 px-3' : 'btn-secondary py-1 px-3'}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleLookup}
              disabled={loading || !name}
              className="btn-primary"
            >
              {loading ? 'Looking up...' : 'Lookup'}
            </button>
            <button onClick={loadExample} className="btn-secondary">
              Example
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="card bg-red-950/30 border-red-900/50 p-4 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Output section */}
        <div className="space-y-4">
          {result && (
            <>
              {/* Add to Report Button */}
              <div className="flex items-center justify-end">
                <AddToReportButton
                  toolId="dns"
                  input={`${name} (${type})`}
                  data={result}
                  category="DNS & Domain"
                />
              </div>
              {/* Summary */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg">{result.name}</span>
                    <span className="badge bg-blue-600">{result.type}</span>
                    {result.cached && (
                      <span className="badge text-gray-500">Cached</span>
                    )}
                  </div>
                  <span className={`text-sm ${result.status === 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {result.status === 0 ? '✓ NOERROR' : `Status: ${result.status}`}
                  </span>
                </div>
              </div>

              {/* Answer records table */}
              {result.answer && result.answer.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="p-3 border-b border-gray-800 bg-gray-900/50">
                    <span className="text-sm font-medium text-gray-400">
                      Answer Records ({result.answer.length})
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-500 text-left">
                          <th className="p-3 font-medium">Name</th>
                          <th className="p-3 font-medium">TTL</th>
                          <th className="p-3 font-medium">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.answer.map((record, idx) => (
                          <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                            <td className="p-3 font-mono text-cyan-400">{record.name}</td>
                            <td className="p-3 text-gray-400">{record.TTL}s</td>
                            <td className="p-3 font-mono text-green-400 break-all">
                              {record.data}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.answer?.length === 0 && (
                <div className="card p-4 text-center text-gray-500">
                  No records found for {result.type} query
                </div>
              )}

              {/* Full JSON result */}
              <JsonViewer data={result} title="Full Response" defaultView="raw" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

