/**
 * ==============================================================================
 * NETKNIFE - CVE & VULNERABILITY LOOKUP (REMOTE)
 * ==============================================================================
 *
 * - Look up CVEs from NVD (NIST) and OSV; optional AI "should I be worried?"
 * - Browse top 30 CVEs by period, severity, and category (e.g. Microsoft, RCE).
 * Free APIs; NVD_API_KEY optional for rate limits.
 * ==============================================================================
 */

import RemoteDisclosure from '../../components/RemoteDisclosure'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { useToolState } from '../../lib/useToolState'

type Mode = 'cve' | 'package' | 'top'

interface CvssMetric {
  score?: number
  severity?: string
  vector?: string
}

interface NvdItem {
  id: string
  description: string
  published: string | null
  updated: string | null
  references: string[]
  cvss?: { v3_1?: CvssMetric; v3_0?: CvssMetric; v2?: CvssMetric }
  cwe: string | null
}

interface CveResult {
  mode: string
  cveId?: string
  nvd?: NvdItem | NvdItem[] | null
  osv?: object | null
  vulns?: Array<{ id: string; summary?: string; aliases?: string[]; severity?: object[] }>
  ecosystem?: string
  package?: string
  version?: string | null
  ai_analysis?: {
    verdict: string
    one_liner: string
    factors: string[]
    recommendation: string
  } | null
  analyze_limited?: boolean
  cached?: boolean
  // top mode
  items?: NvdItem[]
  period?: string
  severity?: string
  category?: string
  total?: number
  apiError?: string
}

function firstNvd(r: CveResult): NvdItem | null {
  const n = r.nvd
  if (Array.isArray(n) && n[0]) return n[0]
  if (n && typeof n === 'object' && 'id' in n) return n as NvdItem
  return null
}

const ECOSYSTEMS = ['npm', 'PyPI', 'Go', 'Maven', 'NuGet', 'RubyGems', 'crates.io', 'Packagist', 'Pub']

const PERIODS = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_90', label: 'Last 90 days' },
]

const SEVERITIES = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'BOTH', label: 'Critical + High' },
]

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'microsoft', label: 'Microsoft' },
  { value: 'apache', label: 'Apache' },
  { value: 'linux kernel', label: 'Linux Kernel' },
  { value: 'cisco', label: 'Cisco' },
  { value: 'vmware', label: 'VMware' },
  { value: 'rce', label: 'RCE' },
  { value: 'auth', label: 'Authentication' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'kubernetes', label: 'Kubernetes' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'adobe', label: 'Adobe' },
  { value: 'fortinet', label: 'Fortinet' },
  { value: 'sap', label: 'SAP' },
  { value: 'google', label: 'Google' },
  { value: 'apple', label: 'Apple' },
  { value: 'php', label: 'PHP' },
  { value: 'jenkins', label: 'Jenkins' },
  { value: 'drupal', label: 'Drupal' },
]

const NVD_URL = (id: string) => `https://nvd.nist.gov/vuln/detail/${id}`

export default function CveLookupTool() {
  const [state, setState] = useToolState(
    'cve-lookup',
    {
      mode: 'top' as Mode,
      cveId: 'CVE-2024-3400',
      ecosystem: 'npm',
      pkg: 'lodash',
      version: '4.17.21',
      analyze: false,
      period: 'last_month',
      severity: 'CRITICAL',
      category: 'all',
      loading: false,
      result: null as CveResult | null,
      error: '',
    },
    { exclude: ['result'] }
  )
  const { mode, cveId, ecosystem, pkg, version, analyze, period, severity, category, loading, result, error } = state

  async function handleLookup() {
    setState({ loading: true, error: '', result: null })
    try {
      const body: Record<string, unknown> = { mode, analyze }
      if (mode === 'cve') {
        body.cveId = (cveId ?? '').trim()
      } else if (mode === 'package') {
        body.ecosystem = (ecosystem ?? '').trim()
        body.package = (pkg ?? '').trim()
        const v = (version ?? '').trim()
        if (v) body.version = v
      } else {
        body.period = period
        body.severity = severity
        body.category = category
      }
      const res = await apiPost<CveResult>('/cve-lookup', body)
      setState({ result: res, loading: false })
    } catch (e) {
      if (e instanceof ApiError) {
        setState({ error: `Error ${e.status}: ${(e.body as { error?: string })?.error || JSON.stringify(e.body)}`, loading: false })
      } else {
        setState({ error: String(e), loading: false })
      }
    }
  }

  async function lookupCveById(id: string) {
    const safeId = (id ?? '').trim()
    if (!safeId) return
    setState({ mode: 'cve', cveId: safeId, result: null, error: '', loading: true })
    try {
      const res = await apiPost<CveResult>('/cve-lookup', { mode: 'cve', cveId: safeId, analyze: false })
      setState({ result: res, loading: false })
    } catch (e) {
      setState({ error: e instanceof ApiError ? (e.body as { error?: string })?.error || String(e.body) : String(e), loading: false })
    }
  }

  const canRun = mode === 'top' || (mode === 'cve' ? (cveId ?? '').trim() : (pkg ?? '').trim())
  const sends =
    mode === 'cve' ? ['CVE ID'] : mode === 'package' ? ['Ecosystem', 'Package name', 'Version (optional)'] : ['Period, severity, category (filters)']

  return (
    <div className="space-y-6">
      <RemoteDisclosure
        sends={sends}
        notes="Uses NVD (NIST) and OSV. Top 30 uses NVD search by date/severity/keyword. Optional AI uses Security Advisor."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setState({ mode: 'top', result: null, error: '' })}
              className={mode === 'top' ? 'btn-primary py-1 px-3' : 'btn-secondary py-1 px-3'}
            >
              Top 30
            </button>
            <button
              onClick={() => setState({ mode: 'cve', result: null, error: '' })}
              className={mode === 'cve' ? 'btn-primary py-1 px-3' : 'btn-secondary py-1 px-3'}
            >
              CVE ID
            </button>
            <button
              onClick={() => setState({ mode: 'package', result: null, error: '' })}
              className={mode === 'package' ? 'btn-primary py-1 px-3' : 'btn-secondary py-1 px-3'}
            >
              Package (OSV)
            </button>
          </div>

          {mode === 'top' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Period</label>
                <select value={period} onChange={(e) => setState({ period: e.target.value })} className="input w-full">
                  {PERIODS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Severity</label>
                <select value={severity} onChange={(e) => setState({ severity: e.target.value })} className="input w-full">
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select value={category} onChange={(e) => setState({ category: e.target.value })} className="input w-full">
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {mode === 'cve' && (
            <div>
              <label className="block text-sm font-medium mb-2">CVE ID</label>
              <input
                type="text"
                value={cveId ?? ''}
                onChange={(e) => setState({ cveId: e.target.value })}
                placeholder="CVE-2024-3400"
                className="input font-mono w-full"
              />
            </div>
          )}

          {mode === 'package' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Ecosystem</label>
                <select value={ecosystem} onChange={(e) => setState({ ecosystem: e.target.value })} className="input w-full">
                  {ECOSYSTEMS.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Package name</label>
                <input
                  type="text"
                  value={pkg}
                  onChange={(e) => setState({ pkg: e.target.value })}
                  placeholder="lodash"
                  className="input font-mono w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Version (optional)</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setState({ version: e.target.value })}
                  placeholder="4.17.21"
                  className="input font-mono w-full"
                />
              </div>
            </>
          )}

          {mode !== 'top' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={analyze} onChange={(e) => setState({ analyze: e.target.checked })} />
              <span className="text-sm">Analyze with AI — &quot;Should I be worried?&quot;</span>
            </label>
          )}

          <button onClick={handleLookup} disabled={loading || !canRun} className="btn-primary">
            {loading ? 'Loading…' : mode === 'top' ? 'Load top 30' : 'Look up'}
          </button>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}
        </div>

        <div className="space-y-4">
          {result?.mode === 'top' && result.items && result.items.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-400">
                  Top {result.items.length} · {result.period} · {result.severity} · {result.category || 'all'}
                  {result.cached && ' · Cached'}
                </span>
                <AddToReportButton
                  toolId="cve-lookup"
                  input={`top:${result.period}-${result.severity}-${result.category || 'all'}`}
                  data={result}
                  category="Threat Intelligence"
                />
              </div>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto max-h-[70vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#161b22]">
                      <tr className="text-left text-gray-400 border-b border-[#30363d]">
                        <th className="px-3 py-2">CVE</th>
                        <th className="px-3 py-2">CVSS</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Published</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((it, idx) => {
                        const id = it?.id ?? ''
                        if (!id) return null
                        const sev = it.cvss?.v3_1 ?? it.cvss?.v3_0
                        const score = sev?.score ?? null
                        const sevLabel = sev?.severity || '—'
                        const badge = (score != null && score >= 9) ? 'bg-red-500/20 text-red-400' : (score != null && score >= 7) ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'
                        return (
                          <tr key={id || `row-${idx}`} className="border-b border-[#21262d] hover:bg-[#21262d]/50">
                            <td className="px-3 py-2">
                              <a href={NVD_URL(id)} target="_blank" rel="noreferrer" className="font-mono text-cyan-400 hover:underline">
                                {id}
                              </a>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${badge}`}>{score != null ? score : '—'} {sevLabel}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-400 max-w-xs truncate" title={it.description || ''}>
                              {it.description?.slice(0, 120) || '—'}{(it.description?.length || 0) > 120 ? '…' : ''}
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{it.published ? new Date(it.published).toLocaleDateString() : '—'}</td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => lookupCveById(id)}
                                className="text-xs text-blue-400 hover:underline"
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {result && result.mode !== 'top' && (
            <>
              <div className="flex justify-end">
                <AddToReportButton
                  toolId="cve-lookup"
                  input={mode === 'cve' ? (cveId ?? '') : `${ecosystem ?? ''}/${pkg ?? ''}${(version ?? '') ? '@' + version : ''}`}
                  data={result}
                  category="Threat Intelligence"
                />
              </div>

              {result.analyze_limited && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                  {(result as { message?: string }).message || 'AI analysis requires API Access subscription.'}
                </div>
              )}

              {result.ai_analysis && (
                <div className="card p-4 border-l-4 border-blue-500/50">
                  <h3 className="font-medium mb-2">AI — Should I be worried?</h3>
                  <p className="text-gray-300 text-sm mb-2">{result.ai_analysis.one_liner}</p>
                  <p className="text-xs text-gray-500 uppercase mb-1">Verdict: {result.ai_analysis.verdict}</p>
                  {result.ai_analysis.factors?.length > 0 && (
                    <ul className="text-sm text-gray-400 list-disc list-inside mb-2">
                      {result.ai_analysis.factors.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  )}
                  <p className="text-sm text-gray-400">{result.ai_analysis.recommendation}</p>
                </div>
              )}

              {firstNvd(result) && (
                <div className="card p-4">
                  <h3 className="font-medium mb-2">NVD (NIST)</h3>
                  {(() => {
                    const n = firstNvd(result)!
                    return (
                      <>
                        <p className="text-sm text-gray-400 mb-2">{n.description?.slice(0, 600)}{(n.description?.length || 0) > 600 ? '…' : ''}</p>
                        {n.cvss?.v3_1 && (
                          <p className="text-sm mb-1">
                            CVSS 3.1: <span className="font-mono">{n.cvss.v3_1.score}</span> ({n.cvss.v3_1.severity})
                            {n.cvss.v3_1.vector && <span className="text-gray-500 ml-2 font-mono text-xs">{n.cvss.v3_1.vector}</span>}
                          </p>
                        )}
                        {n.cwe && <p className="text-sm text-gray-500">CWE: {n.cwe}</p>}
                        {n.published && <p className="text-xs text-gray-500">Published: {n.published}</p>}
                        {n.references?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">References:</p>
                            <ul className="text-xs space-y-0.5 max-h-32 overflow-auto">
                              {n.references.slice(0, 8).map((r, i) => (
                                <li key={i}><a href={r} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate block">{r}</a></li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {result.vulns && result.vulns.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-medium mb-2">OSV — Package vulns ({result.vulns.length})</h3>
                  <ul className="space-y-2 text-sm">
                    {result.vulns.slice(0, 10).map((v, i) => (
                      <li key={i} className="border-b border-gray-800/50 pb-2">
                        <span className="font-mono text-cyan-400">{v.id}</span>
                        {v.aliases?.length ? <span className="text-gray-500 ml-2">({v.aliases.join(', ')})</span> : null}
                        {v.summary && <p className="text-gray-400 text-xs mt-0.5">{v.summary.slice(0, 200)}…</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.osv && typeof result.osv === 'object' && !result.vulns && (
                <div className="card p-4">
                  <h3 className="font-medium mb-2">OSV</h3>
                  <pre className="text-xs bg-gray-900 rounded p-3 overflow-auto max-h-48">{JSON.stringify(result.osv, null, 2)}</pre>
                </div>
              )}

              {result.cached && <span className="badge text-gray-500">Cached</span>}
            </>
          )}

          {result?.mode === 'top' && result.items?.length === 0 && (
            <div className={`card p-6 text-center ${result.apiError ? 'border-amber-500/50 bg-amber-500/5' : ''}`}>
              {result.apiError ? (
                <>
                  <p className="text-amber-400 font-medium">NVD API issue</p>
                  <p className="text-gray-400 text-sm mt-2">{result.apiError}</p>
                </>
              ) : (
                <p className="text-gray-400">No CVEs found for this period/severity/category.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related Resources */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <span>📚</span>
          <span>Related Resources</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <a
            href="https://cve.mitre.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-blue-400 hover:text-blue-300"
          >
            <span className="text-xs">↗</span>
            <div>
              <div className="font-medium">CVE Database (MITRE)</div>
              <div className="text-xs text-gray-500">Official CVE reference</div>
            </div>
          </a>
          <a
            href="https://www.cvedetails.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-blue-400 hover:text-blue-300"
          >
            <span className="text-xs">↗</span>
            <div>
              <div className="font-medium">CVE Details</div>
              <div className="text-xs text-gray-500">Enhanced CVE database</div>
            </div>
          </a>
          <a
            href="https://www.first.org/cvss/calculator/3.0"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-blue-400 hover:text-blue-300"
          >
            <span className="text-xs">↗</span>
            <div>
              <div className="font-medium">CVSS Calculator</div>
              <div className="text-xs text-gray-500">Calculate severity scores</div>
            </div>
          </a>
          <a
            href="https://www.exploit-db.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-blue-400 hover:text-blue-300"
          >
            <span className="text-xs">↗</span>
            <div>
              <div className="font-medium">Exploit Database</div>
              <div className="text-xs text-gray-500">Public exploits archive</div>
            </div>
          </a>
          <a
            href="https://attack.mitre.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-blue-400 hover:text-blue-300"
          >
            <span className="text-xs">↗</span>
            <div>
              <div className="font-medium">MITRE ATT&CK</div>
              <div className="text-xs text-gray-500">Adversary tactics framework</div>
            </div>
          </a>
          <a
            href="/tools/security-resources"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-green-400 hover:text-green-300"
          >
            <span className="text-xs">→</span>
            <div>
              <div className="font-medium">All Security Resources</div>
              <div className="text-xs text-gray-500">Browse 190+ resources</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
