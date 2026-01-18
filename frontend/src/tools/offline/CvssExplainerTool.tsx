/**
 * ==============================================================================
 * NETKNIFE - CVSS EXPLAINER (OFFLINE)
 * ==============================================================================
 *
 * Pastes a CVSS vector (2.0 or 3.x); explains each metric and computes base
 * score for 3.0/3.1. Runs entirely in the browser.
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import AddToReportButton from '../../components/AddToReportButton'

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

export default function CvssExplainerTool() {
  const [vector, setVector] = useState('')
  const [example] = useState('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')

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
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">CVSS Vector</label>
            <textarea
              value={vector}
              onChange={(e) => setVector(e.target.value)}
              placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
              rows={3}
              className="input font-mono w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setVector(example)}
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
