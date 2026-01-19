/**
 * ==============================================================================
 * NETKNIFE - CVSS EXPLAINER (OFFLINE)
 * ==============================================================================
 *
 * Pastes a CVSS vector (2.0 or 3.x); explains each metric and computes base
 * score for 3.0/3.1. Runs entirely in the browser.
 * ==============================================================================
 */

import { useMemo } from 'react'
import AddToReportButton from '../../components/AddToReportButton'
import { useToolState } from '../../lib/useToolState'

// Short explanations for each CVSS 3.x Base metric (for the help panel)
const METRIC_HELP_31: { abbr: string; name: string; desc: string; opts: string }[] = [
  { abbr: 'AV', name: 'Attack Vector', desc: 'How far away an attacker can be to exploit.', opts: 'N=Network, A=Adjacent, L=Local, P=Physical' },
  { abbr: 'AC', name: 'Attack Complexity', desc: 'Conditions beyond the attacker’s control that must exist.', opts: 'L=Low, H=High' },
  { abbr: 'PR', name: 'Privileges Required', desc: 'Level of privileges the attacker must have beforehand.', opts: 'N=None, L=Low, H=High' },
  { abbr: 'UI', name: 'User Interaction', desc: 'Whether the victim must do something (e.g. open a link).', opts: 'N=None, R=Required' },
  { abbr: 'S', name: 'Scope', desc: 'Can the flaw affect components outside its security scope?', opts: 'U=Unchanged, C=Changed' },
  { abbr: 'C', name: 'Confidentiality', desc: 'Impact on confidentiality of information.', opts: 'N=None, L=Low, H=High' },
  { abbr: 'I', name: 'Integrity', desc: 'Impact on integrity of data or software.', opts: 'N=None, L=Low, H=High' },
  { abbr: 'A', name: 'Availability', desc: 'Impact on availability of the system or data.', opts: 'N=None, L=Low, H=High' },
]

const CVSS31_LABELS: Record<string, Record<string, string>> = {
  AV: { N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' },
  AC: { L: 'Low', H: 'High' },
  PR: { N: 'None', L: 'Low', H: 'High' },
  UI: { N: 'None', R: 'Required' },
  S:  { U: 'Unchanged', C: 'Changed' },
  C:  { N: 'None', L: 'Low', H: 'High' },
  I:  { N: 'None', L: 'Low', H: 'High' },
  A:  { N: 'None', L: 'Low', H: 'High' },
}

const CVSS20_LABELS: Record<string, Record<string, string>> = {
  AV: { N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' },
  AC: { L: 'Low', M: 'Medium', H: 'High' },
  Au: { M: 'Multiple', S: 'Single', N: 'None' },
  C:  { N: 'None', P: 'Partial', C: 'Complete' },
  I:  { N: 'None', P: 'Partial', C: 'Complete' },
  A:  { N: 'None', P: 'Partial', C: 'Complete' },
}

// CVSS 3.1 numeric values for base score
const V31: Record<string, Record<string, number>> = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  PR: { N: 0.85, L: 0.62, H: 0.27 }, // S=U; for S=C: L=0.68, H=0.50
  PRC: { N: 0.85, L: 0.68, H: 0.50 },
  UI: { N: 0.85, R: 0.62 },
  C: { N: 0, L: 0.22, H: 0.56 },
  I: { N: 0, L: 0.22, H: 0.56 },
  A: { N: 0, L: 0.22, H: 0.56 },
}

function parseVector(input: string): { version: string; metrics: Record<string, string> } | null {
  const s = (input || '').trim()
  const m = s.match(/^CVSS:?(3\.1|3\.0|2\.0)?\/?(.*)$/i)
  if (!m) return null
  const version = (m[1] || '3.1').toLowerCase()
  const rest = (m[2] || '').trim()
  const metrics: Record<string, string> = {}
  for (const part of rest.split('/')) {
    const [k, v] = part.split(':')
    if (k && v) metrics[k] = v
  }
  return { version, metrics }
}

function severityBand(score: number): string {
  if (score <= 0) return 'None'
  if (score < 4) return 'Low'
  if (score < 7) return 'Medium'
  if (score < 9) return 'High'
  return 'Critical'
}

function roundUp(n: number): number {
  return Math.ceil(n * 10) / 10
}

function computeCvss31Base(metrics: Record<string, string>): number | null {
  const av = V31.AV[metrics.AV]; const ac = V31.AC[metrics.AC]; const ui = V31.UI[metrics.UI]
  const pr = (metrics.S === 'C' ? V31.PRC : V31.PR)[metrics.PR] ?? 0.85
  const c = V31.C[metrics.C] ?? 0; const i = V31.I[metrics.I] ?? 0; const a = V31.A[metrics.A] ?? 0
  if ([av, ac, pr, ui].some((x) => x == null)) return null
  const exploit = 8.22 * av * ac * pr * ui
  const iscBase = 1 - (1 - c) * (1 - i) * (1 - a)
  let impact: number
  if (metrics.S === 'C') {
    impact = 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15)
    if (impact < 0) impact = 0
  } else {
    impact = 6.42 * iscBase
  }
  const raw = impact + exploit
  if (raw <= 0) return 0
  return roundUp(Math.min(10, raw))
}

const EXAMPLE = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'

export default function CvssExplainerTool() {
  const [state, setState] = useToolState('cvss-explainer', { vector: '' })
  const { vector } = state

  const parsed = useMemo(() => parseVector(vector), [vector])
  const is31 = parsed?.version?.startsWith('3')
  const is20 = parsed?.version === '2.0'
  const labels = is20 ? CVSS20_LABELS : CVSS31_LABELS
  const computedScore = is31 && parsed ? computeCvss31Base(parsed.metrics) : null

  const explained = useMemo(() => {
    if (!parsed) return []
    return Object.entries(parsed.metrics).map(([k, v]) => ({
      key: k,
      value: v,
      label: (labels as Record<string, Record<string, string>>)[k]?.[v] ?? v,
    }))
  }, [parsed, labels])

  const result = useMemo(() => {
    if (!parsed) return null
    return {
      version: parsed.version,
      metrics: explained,
      baseScore: computedScore,
      severity: computedScore != null ? severityBand(computedScore) : null,
    }
  }, [parsed, explained, computedScore])

  return (
    <div className="space-y-6">
      {/* --- About CVSS & how to use --- */}
      <details className="card" open>
        <summary className="cursor-pointer list-none font-medium text-gray-200 pb-2 [&::-webkit-details-marker]:hidden">
          What is CVSS and how do I use this?
        </summary>
        <div className="text-sm text-gray-400 space-y-4 pt-2 border-t border-[#30363d]">
          <div>
            <p className="text-gray-300 mb-1"><strong>What is CVSS?</strong></p>
            <p>
              <strong>CVSS (Common Vulnerability Scoring System)</strong> is a standard way to rate the severity of security
              vulnerabilities. A <strong>vector string</strong> encodes the metrics (e.g. how an attack happens, what the impact is).
              From that, a <strong>base score</strong> (0–10) and <strong>severity</strong> (None, Low, Medium, High, Critical) are
              computed. CVSS 2.0, 3.0, and 3.1 are in common use; this tool explains 2.0 and 3.x and computes the base score for 3.0/3.1.
            </p>
          </div>
          <div>
            <p className="text-gray-300 mb-1"><strong>How to use this tool</strong></p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Paste a <strong>CVSS vector</strong> into the text area (e.g. from an advisory, NVD, or the CVE & Exploit Intel tool).</li>
              <li>Use <strong>Load example</strong> to see a sample 3.1 vector decoded.</li>
              <li>The tool will <strong>explain each metric</strong> in plain English and, for 3.0/3.1, <strong>compute the base score</strong> and severity. For 2.0 it only decodes the metrics; use the <a href="https://www.first.org/cvss/calculator/2.0" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">FIRST calculator</a> for the score.</li>
            </ol>
          </div>
          <div>
            <p className="text-gray-300 mb-1"><strong>What does the example vector mean?</strong></p>
            <p className="font-mono text-cyan-300/90 text-xs mb-2">CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H</p>
            <ul className="space-y-0.5 text-gray-400">
              <li><strong className="text-gray-300">AV:N</strong> — Attack Vector <strong>Network</strong>: exploitable over the network (e.g. internet) without being on the same LAN.</li>
              <li><strong className="text-gray-300">AC:L</strong> — Attack Complexity <strong>Low</strong>: no special conditions needed.</li>
              <li><strong className="text-gray-300">PR:N</strong> — Privileges Required <strong>None</strong>: no login or special access.</li>
              <li><strong className="text-gray-300">UI:N</strong> — User Interaction <strong>None</strong>: no user action (e.g. opening a link) required.</li>
              <li><strong className="text-gray-300">S:U</strong> — Scope <strong>Unchanged</strong>: only the vulnerable component is affected.</li>
              <li><strong className="text-gray-300">C:H / I:H / A:H</strong> — <strong>High</strong> impact on Confidentiality, Integrity, and Availability (e.g. full system compromise).</li>
            </ul>
            <p className="mt-2">That combination yields a <strong>9.8 Critical</strong> base score: easily exploitable over the network with no privileges or user action and severe impact.
            </p>
          </div>
          <div>
            <p className="text-gray-300 mb-1"><strong>Where do I find CVSS vectors?</strong></p>
            <ul className="space-y-0.5">
              <li><strong>NVD (NIST)</strong> — On each <a href="https://nvd.nist.gov/vuln/detail/CVE-2024-3400" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">CVE detail page</a>, under &quot;CVSS 3.x&quot; or &quot;CVSS 2.0&quot; as a vector (e.g. CVSS:3.1/AV:N/...).</li>
              <li><strong>NetKnife CVE & Exploit Intel</strong> — Look up a CVE or browse top vulns; the NVD result includes the vector. Use <strong>Details</strong> on a row to see the full vector, or open the NVD link.</li>
              <li><strong>Vendor and project advisories</strong> — Many publish a CVSS vector (e.g. GitHub Security, Red Hat, Cisco).</li>
              <li><strong>Vuln databases and scanners</strong> — Qualys, Tenable, etc. often show or export vectors.</li>
              <li>The vector can appear with or without a <code className="bg-[#21262d] px-1 rounded">CVSS:3.1/</code> prefix; this tool accepts both (e.g. <code className="bg-[#21262d] px-1 rounded">AV:N/AC:L/...</code>).</li>
            </ul>
          </div>
          <div>
            <p className="text-gray-300 mb-1"><strong>CVSS 3.x Base metric reference</strong></p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-[#30363d]">
                    <th className="py-1 pr-2">Abbr</th>
                    <th className="py-1 pr-2">Name</th>
                    <th className="py-1">Options</th>
                  </tr>
                </thead>
                <tbody>
                  {METRIC_HELP_31.map((m) => (
                    <tr key={m.abbr} className="border-b border-[#21262d]">
                      <td className="py-1 pr-2 font-mono text-cyan-300/90">{m.abbr}</td>
                      <td className="py-1 pr-2 text-gray-400">{m.name}</td>
                      <td className="py-1 text-gray-500">{m.opts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </details>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">CVSS Vector</label>
            <textarea
              value={vector}
              onChange={(e) => setState({ vector: e.target.value })}
              placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
              rows={3}
              className="input font-mono w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setState({ vector: EXAMPLE })}
              className="btn-secondary"
            >
              Load example
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {result && (
            <>
              <div className="flex items-center justify-end">
                <AddToReportButton
                  toolId="cvss-explainer"
                  input={vector.slice(0, 80)}
                  data={result}
                  category="Threat Intelligence"
                />
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-400 mb-2">Version: {result.version}</div>
                {result.baseScore != null && (
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-2xl font-bold">{result.baseScore}</span>
                    <span className={`text-sm font-medium ${
                      result.severity === 'Critical' ? 'text-red-400' :
                      result.severity === 'High' ? 'text-orange-400' :
                      result.severity === 'Medium' ? 'text-yellow-400' : 'text-gray-400'
                    }`}>
                      {result.severity}
                    </span>
                  </div>
                )}
                <div className="space-y-2">
                  {result.metrics.map((m) => (
                    <div key={m.key} className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 font-mono">{m.key}:</span>
                      <span className="text-gray-300">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {parsed?.version === '2.0' && (
                <p className="text-xs text-gray-500">CVSS 2.0 base score is not computed here. Use the <a href="https://www.first.org/cvss/calculator/2.0" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">FIRST calculator</a>.</p>
              )}
            </>
          )}
          {!result && vector.trim() && (
            <div className="card p-4 text-amber-400/90 text-sm">Paste a valid CVSS vector (e.g. CVSS:3.1/AV:N/AC:L/...) or CVSS:2.0/...</div>
          )}
        </div>
      </div>
    </div>
  )
}
