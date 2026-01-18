/**
 * ==============================================================================
 * NETKNIFE - CVE & VULNERABILITY LOOKUP (REMOTE)
 * ==============================================================================
 *
 * Look up CVEs from NVD (NIST) and OSV; optional AI "should I be worried?"
 * analysis. Free APIs; no keys required (NVD_API_KEY optional for rate limits).
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'

type Mode = 'cve' | 'package'

interface NvdItem {
  id: string
  description: string
  published: string | null
  updated: string | null
  references: string[]
  cvss: { v3_1?: { score: number; severity: string; vector: string }; v3_0?: object; v2?: object }
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
}

function firstNvd(r: CveResult): NvdItem | null {
  const n = r.nvd
  if (Array.isArray(n) && n[0]) return n[0]
  if (n && typeof n === 'object' && 'id' in n) return n as NvdItem
  return null
}

const ECOSYSTEMS = ['npm', 'PyPI', 'Go', 'Maven', 'NuGet', 'RubyGems', 'crates.io', 'Packagist', 'Pub']

export default function CveLookupTool() {
  const [mode, setMode] = useState<Mode>('cve')
  const [cveId, setCveId] = useState('CVE-2024-3400')
  const [ecosystem, setEcosystem] = useState('npm')
  const [pkg, setPkg] = useState('lodash')
  const [version, setVersion] = useState('4.17.21')
  const [analyze, setAnalyze] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CveResult | null>(null)
  const [error, setError] = useState('')

  async function handleLookup() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const body: Record<string, unknown> = { mode, analyze }
      if (mode === 'cve') {
        body.cveId = cveId.trim()
      } else {
        body.ecosystem = ecosystem.trim()
        body.package = pkg.trim()
        if (version.trim()) body.version = version.trim()
      }
      const res = await apiPost<CveResult>('/cve-lookup', body)
      setResult(res)
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`Error ${e.status}: ${(e.body as { error?: string })?.error || JSON.stringify(e.body)}`)
      } else {
        setError(String(e))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure
        sends={mode === 'cve' ? ['CVE ID'] : ['Ecosystem', 'Package name', 'Version (optional)']}
        notes="Uses free NVD (NIST) and OSV APIs. Optional AI analysis uses Security Advisor quota."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('cve')}
              className={mode === 'cve' ? 'btn-primary py-1 px-3' : 'btn-secondary py-1 px-3'}
            >
              CVE ID
            </button>
            <button
              onClick={() => setMode('package')}
              className={mode === 'package' ? 'btn-primary py-1 px-3' : 'btn-secondary py-1 px-3'}
            >
              Package (OSV)
            </button>
          </div>

          {mode === 'cve' && (
            <div>
              <label className="block text-sm font-medium mb-2">CVE ID</label>
              <input
                type="text"
                value={cveId}
                onChange={(e) => setCveId(e.target.value)}
                placeholder="CVE-2024-3400"
                className="input font-mono w-full"
              />
            </div>
          )}

          {mode === 'package' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Ecosystem</label>
                <select
                  value={ecosystem}
                  onChange={(e) => setEcosystem(e.target.value)}
                  className="input w-full"
                >
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
                  onChange={(e) => setPkg(e.target.value)}
                  placeholder="lodash"
                  className="input font-mono w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Version (optional)</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="4.17.21"
                  className="input font-mono w-full"
                />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={analyze} onChange={(e) => setAnalyze(e.target.checked)} />
            <span className="text-sm">Analyze with AI — &quot;Should I be worried?&quot;</span>
          </label>

          <button
            onClick={handleLookup}
            disabled={loading || (mode === 'cve' ? !cveId.trim() : !pkg.trim())}
            className="btn-primary"
          >
            {loading ? 'Looking up…' : 'Look up'}
          </button>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}
        </div>

        <div className="space-y-4">
          {result && (
            <>
              <div className="flex justify-end">
                <AddToReportButton
                  toolId="cve-lookup"
                  input={mode === 'cve' ? cveId : `${ecosystem}/${pkg}${version ? '@' + version : ''}`}
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
        </div>
      </div>
    </div>
  )
}
