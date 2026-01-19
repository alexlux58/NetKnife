/**
 * ==============================================================================
 * NETKNIFE - SSL LABS TOOL
 * ==============================================================================
 */

import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'
import { useToolState } from '../../lib/useToolState'

interface SslLabsResult {
  host: string
  status: string
  grade?: string
  gradeTrustIgnored?: string
  hasWarnings?: boolean
  isExceptional?: boolean
  endpoints?: {
    ipAddress: string
    grade: string
    hasWarnings: boolean
  }[]
  protocols?: { name: string; version: string }[]
  vulnerabilities?: Record<string, boolean | number>
  message?: string
  progress?: number
}

const gradeColors: Record<string, string> = {
  'A+': 'text-emerald-400 bg-emerald-400/20',
  'A': 'text-emerald-400 bg-emerald-400/20',
  'A-': 'text-green-400 bg-green-400/20',
  'B': 'text-yellow-400 bg-yellow-400/20',
  'C': 'text-orange-400 bg-orange-400/20',
  'D': 'text-red-400 bg-red-400/20',
  'E': 'text-red-500 bg-red-500/20',
  'F': 'text-red-600 bg-red-600/20',
  'T': 'text-red-600 bg-red-600/20',
}

export default function SslLabsTool() {
  const [state, setState] = useToolState(
    'ssl-labs',
    { host: 'example.com', loading: false, result: null as SslLabsResult | null, error: '' },
    { exclude: ['result', 'loading', 'error'] }
  )
  const { host, loading, result, error } = state

  async function handleCheck() {
    setState({ loading: true, error: '', result: null })
    try {
      const data = await apiPost<SslLabsResult>('/ssl-labs', { host })
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
        <h1 className="text-2xl font-bold">SSL Labs</h1>
        <p className="text-gray-400 mt-1">
          Qualys SSL Server Test - comprehensive SSL/TLS grade
        </p>
      </div>

      <RemoteDisclosure 
        sends={['Hostname']} 
        notes="Uses cached results from SSL Labs. New scans may take several minutes."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Hostname</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setState({ host: e.target.value })}
              placeholder="example.com"
              className="input"
            />
          </div>
          <button onClick={handleCheck} disabled={loading || !host} className="btn btn-primary w-full">
            {loading ? 'Checking...' : 'Check SSL Grade'}
          </button>
        </div>

        <div className="space-y-4">
          {result && (
            <>
              {/* Add to Report Button */}
              {result.status === 'ready' && result.grade && (
                <div className="flex items-center justify-end">
                  <AddToReportButton
                    toolId="ssl-labs"
                    input={host}
                    data={result}
                    category="Certificates & TLS"
                  />
                </div>
              )}
              {result.status === 'ready' && result.grade && (
            <div className="card p-6 text-center">
              <div className="text-sm text-gray-500 mb-2">SSL Grade</div>
              <div className={`inline-block text-6xl font-bold px-6 py-3 rounded-lg ${gradeColors[result.grade] || 'text-gray-400'}`}>
                {result.grade}
              </div>
              {result.hasWarnings && (
                <div className="mt-2 text-yellow-400 text-sm">⚠ Has warnings</div>
              )}
              {result.isExceptional && (
                <div className="mt-2 text-emerald-400 text-sm">✓ Exceptional configuration</div>
              )}
            </div>
          )}

          {result && result.status === 'pending' && (
            <div className="card p-6 text-center space-y-3">
              <div className="text-yellow-400">⏳ {result.message}</div>
              <button 
                onClick={handleCheck} 
                disabled={loading}
                className="btn btn-secondary mt-4"
              >
                {loading ? 'Checking...' : 'Check Again'}
              </button>
            </div>
          )}

          {result && result.status === 'in_progress' && (
            <div className="card p-6 text-center space-y-3">
              <div className="text-blue-400">🔄 {result.message}</div>
              {result.progress !== undefined && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-500">Progress: {result.progress}%</div>
                  {result.progress >= 100 && (
                    <div className="text-xs text-yellow-400 mt-2">
                      Scan appears complete. Click "Check SSL Grade" again to fetch results.
                    </div>
                  )}
                  {result.progress < 100 && result.progress > 0 && (
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${result.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
              <button 
                onClick={handleCheck} 
                disabled={loading}
                className="btn btn-secondary mt-4"
              >
                {loading ? 'Checking...' : 'Check Again'}
              </button>
            </div>
          )}

          {result && result.protocols && (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Supported Protocols</h3>
              <div className="flex flex-wrap gap-2">
                {result.protocols.map((p, i) => (
                  <span key={i} className={`px-2 py-1 rounded text-xs ${
                    p.name.includes('1.3') ? 'bg-emerald-500/20 text-emerald-400' :
                    p.name.includes('1.2') ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {p.name} {p.version}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result && result.vulnerabilities && (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Vulnerability Checks</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(result.vulnerabilities).map(([vuln, status]) => (
                  <div key={vuln} className={`flex items-center gap-2 ${status ? 'text-red-400' : 'text-emerald-400'}`}>
                    {status ? '✗' : '✓'} {vuln}
                  </div>
                ))}
              </div>
            </div>
          )}

          <JsonViewer title="Full Response" json={result} error={error} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

