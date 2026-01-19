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

export default function HeadersTool() {
  const [state, setState] = useToolState(
    'headers',
    { url: 'https://example.com', loading: false, output: '', error: '', resultData: null as any },
    { exclude: ['output', 'resultData'] }
  )
  const { url, loading, output, error, resultData } = state

  async function handleScan() {
    setState({ loading: true, error: '', resultData: null })
    try {
      const result = await apiPost('/headers', { url })
      setState({ resultData: result, output: formatJson(result), loading: false })
    } catch (e) {
      if (e instanceof ApiError) {
        const errorData = { error: `Error ${e.status}: ${formatJson(e.body)}` }
        setState({ resultData: errorData, error: `Error ${e.status}: ${formatJson(e.body)}`, output: '', loading: false })
      } else {
        const errorData = { error: String(e) }
        setState({ resultData: errorData, error: String(e), output: '', loading: false })
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
        {output && resultData && (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <AddToReportButton
                toolId="headers"
                input={url}
                data={resultData}
                category="Email Security"
              />
            </div>
            <OutputCard title="Headers Analysis" value={output} />
          </div>
        )}
      </div>
    </div>
  )
}

