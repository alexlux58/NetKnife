/**
 * ==============================================================================
 * NETKNIFE - HTTP HEADERS SCANNER TOOL
 * ==============================================================================
 * 
 * Scans URLs for HTTP security headers.
 * 
 * FEATURES:
 * - Security header analysis (HSTS, CSP, X-Frame-Options, etc.)
 * - Redirect chain following
 * - Response header inspection
 * - SSRF-safe (blocks private IPs)
 * 
 * SECURITY HEADERS CHECKED:
 * - Strict-Transport-Security (HSTS)
 * - Content-Security-Policy (CSP)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Referrer-Policy
 * - Permissions-Policy
 * 
 * NOTE: This is a REMOTE tool - requests are made from AWS Lambda.
 * ==============================================================================
 */

import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'
import { useToolState } from '../../lib/useToolState'

interface SecurityHeaders {
  present: Record<string, string>
  missing: string[]
}

interface ChainItem {
  url: string
  status: number
  location?: string
  security_headers: SecurityHeaders
  headers: Record<string, string>
}

interface HeadersResult {
  input: string
  final_url: string
  redirects: number
  chain: ChainItem[]
}

export default function HeadersTool() {
  const [state, setState] = useToolState(
    'headers',
    { url: 'https://example.com', loading: false, output: '', error: '', resultData: null as HeadersResult | null },
    { exclude: ['output', 'resultData'] }
  )
  const { url, loading, output, error, resultData } = state

  async function handleScan() {
    setState({ loading: true, error: '', resultData: null })
    try {
      const result = await apiPost<HeadersResult>('/headers', { url })
      setState({ resultData: result, output: formatJson(result), loading: false })
    } catch (e) {
      if (e instanceof ApiError) {
        setState({ resultData: null, error: `Error ${e.status}: ${formatJson(e.body)}`, output: '', loading: false })
      } else {
        setState({ resultData: null, error: String(e), output: '', loading: false })
      }
    }
  }

  const examples = [
    { label: 'GitHub', value: 'https://github.com' },
    { label: 'Google', value: 'https://google.com' },
    { label: 'Cloudflare', value: 'https://cloudflare.com' },
  ]

  return (
    <div className="space-y-6">
      {/* Remote disclosure */}
      <RemoteDisclosure
        sends={['Full URL (scheme, host, path)']}
        notes="Only http/https on ports 80/443. Private IPs are blocked. Max 5 redirects."
      />

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          {/* URL input */}
          <div>
            <label className="block text-sm font-medium mb-2">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setState({ url: e.target.value })}
              placeholder="https://example.com"
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be http:// or https://
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleScan}
              disabled={loading || !url}
              className="btn-primary"
            >
              {loading ? 'Scanning...' : 'Scan Headers'}
            </button>
          </div>

          {/* Examples */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Examples</label>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex.value}
                  onClick={() => setState({ url: ex.value })}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="card bg-red-950/30 border-red-900/50 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Security headers reference */}
          <div className="card p-4 text-sm">
            <h4 className="font-medium mb-2">Security Headers</h4>
            <div className="space-y-1 text-gray-400 text-xs">
              <div><strong>HSTS</strong> - Forces HTTPS connections</div>
              <div><strong>CSP</strong> - Prevents XSS and injection</div>
              <div><strong>X-Frame-Options</strong> - Prevents clickjacking</div>
              <div><strong>X-Content-Type-Options</strong> - Prevents MIME sniffing</div>
              <div><strong>Referrer-Policy</strong> - Controls referrer info</div>
            </div>
          </div>
        </div>

        {/* Output section */}
        {resultData && (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <AddToReportButton
                toolId="headers"
                input={url}
                data={resultData}
                category="Certificates & TLS"
              />
            </div>

            {/* Summary */}
            {resultData.chain && resultData.chain.length > 0 && (() => {
              const final = resultData.chain[resultData.chain.length - 1]
              const presentCount = Object.keys(final.security_headers?.present || {}).length
              const totalHeaders = 9 // Total security headers checked
              const score = Math.round((presentCount / totalHeaders) * 100)
              const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
              
              return (
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Security Headers Score</h3>
                    <span className={`text-2xl font-bold ${scoreColor}`}>{score}%</span>
                  </div>
                  <div className="text-sm text-gray-400 mb-3">
                    {presentCount} of {totalHeaders} security headers present
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 mb-1">Final URL: <span className="font-mono text-gray-400">{resultData.final_url}</span></div>
                    {resultData.redirects > 0 && (
                      <div className="text-xs text-gray-500">
                        Redirects: {resultData.redirects}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Security Headers Breakdown */}
            {resultData.chain && resultData.chain.length > 0 && (() => {
              const final = resultData.chain[resultData.chain.length - 1]
              const headerNames: Record<string, string> = {
                'strict-transport-security': 'HSTS',
                'content-security-policy': 'CSP',
                'x-frame-options': 'X-Frame-Options',
                'x-content-type-options': 'X-Content-Type-Options',
                'referrer-policy': 'Referrer-Policy',
                'permissions-policy': 'Permissions-Policy',
                'cross-origin-opener-policy': 'COOP',
                'cross-origin-embedder-policy': 'COEP',
                'cross-origin-resource-policy': 'CORP',
              }
              
              return (
                <div className="card p-4">
                  <h3 className="font-medium mb-3">Security Headers</h3>
                  <div className="space-y-2">
                    {Object.entries(headerNames).map(([key, name]) => {
                      const isPresent = final.security_headers?.present?.[key]
                      return (
                        <div key={key} className="flex items-center justify-between p-2 rounded bg-[#161b22]">
                          <span className="text-sm">{name}</span>
                          {isPresent ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-emerald-400">✓ Present</span>
                              <span className="text-xs text-gray-500 font-mono max-w-[300px] truncate" title={isPresent}>
                                {isPresent.length > 40 ? isPresent.substring(0, 40) + '...' : isPresent}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-red-400">✗ Missing</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Redirect Chain */}
            {resultData.chain && resultData.chain.length > 1 && (
              <div className="card p-4">
                <h3 className="font-medium mb-3">Redirect Chain</h3>
                <div className="space-y-2">
                  {resultData.chain.map((item, idx) => (
                    <div key={idx} className="p-2 rounded bg-[#161b22] text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-500">#{idx + 1}</span>
                        <span className="font-mono text-xs text-cyan-400 break-all">{item.url}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          item.status >= 200 && item.status < 300 ? 'bg-green-500/20 text-green-400' :
                          item.status >= 300 && item.status < 400 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      {item.location && (
                        <div className="text-xs text-gray-500 ml-6">
                          → {item.location}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full JSON Output */}
            {output && (
              <OutputCard title="Full Response" value={output} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

