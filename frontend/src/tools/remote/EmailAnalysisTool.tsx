/**
 * ==============================================================================
 * NETKNIFE - EMAIL ANALYSIS (CONSOLIDATED)
 * ==============================================================================
 *
 * Run one email through multiple checks at once: reputation, breaches,
 * verification, Hunter, and the domain's SPF/DKIM/DMARC.
 *
 * Replaces: EmailRep, Breach Check, IPQS Email, Hunter (email mode) — single input, combined output.
 * ==============================================================================
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import RemoteDisclosure from '../../components/RemoteDisclosure'

interface EmailAnalysisResult {
  email: string
  domain: string
  emailrep?: { error?: string; [k: string]: unknown }
  breachdirectory?: { error?: string; [k: string]: unknown }
  ipqsEmail?: { error?: string; [k: string]: unknown }
  hunter?: { error?: string; [k: string]: unknown }
  emailAuth?: { error?: string; [k: string]: unknown }
  recommendations: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

function row(label: string, value: React.ReactNode, ok?: boolean) {
  return (
    <div key={label} className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm ${ok === false ? 'text-red-400' : ok === true ? 'text-green-400' : ''}`}>
        {value}
      </span>
    </div>
  )
}

export default function EmailAnalysisTool() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EmailAnalysisResult | null>(null)
  const [error, setError] = useState('')

  async function handleAnalyze() {
    const e = email.trim()
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    const domain = e.split('@')[1] || ''

    const emailrepP = apiClient.post('/emailrep', { email: e }).catch((err) => ({ error: err instanceof Error ? err.message : 'Failed' }))
    const breachP = apiClient.post('/breachdirectory', { email: e }).catch((err) => ({ error: err instanceof Error ? err.message : 'Failed' }))
    const ipqsP = apiClient.post('/ipqs-email', { email: e }).catch((err) => ({ error: err instanceof Error ? err.message : 'Failed' }))
    const hunterP = apiClient.post('/hunter', { email: e }).catch((err) => ({ error: err instanceof Error ? err.message : 'Failed' }))
    const authP = apiClient.post('/email-auth', { domain, dkimSelector: 'default' }).catch((err) => ({ error: err instanceof Error ? err.message : 'Failed' }))

    try {
      type R = Record<string, unknown>
      const [emailrep, breachdirectory, ipqsEmail, hunter, emailAuth] = (await Promise.all([
        emailrepP,
        breachP,
        ipqsP,
        hunterP,
        authP,
      ])) as [R, R, R, R, R]

      const recommendations: string[] = []
      let risk = 0

      if (!('error' in breachdirectory) && breachdirectory.found) {
        risk += 40
        recommendations.push('Email found in data breaches — change passwords and enable 2FA.')
      }
      if (!('error' in emailrep) && (emailrep as { suspicious?: boolean }).suspicious) {
        risk += 30
        recommendations.push('Email flagged as suspicious — exercise caution.')
      }
      if (!('error' in emailrep) && (emailrep as { details?: { credentials_leaked?: boolean } }).details?.credentials_leaked) {
        risk += 25
        recommendations.push('Credentials leaked — change password immediately.')
      }
      if (!('error' in ipqsEmail) && (ipqsEmail as { disposable?: boolean }).disposable) {
        risk += 20
        recommendations.push('Disposable email — may indicate a temporary account.')
      }
      if (!('error' in ipqsEmail) && (ipqsEmail as { honeypot?: boolean }).honeypot) {
        risk += 30
        recommendations.push('Honeypot/spamtrap — do not use for signups.')
      }
      if (!('error' in ipqsEmail) && (ipqsEmail as { recent_abuse?: boolean }).recent_abuse) {
        risk += 35
        recommendations.push('Recent abuse detected — investigate before trusting.')
      }
      if (!('error' in ipqsEmail) && typeof (ipqsEmail as { overall_score?: number }).overall_score === 'number' && (ipqsEmail as { overall_score: number }).overall_score > 75) {
        risk += 25
      }
      if (recommendations.length === 0) {
        recommendations.push('No major issues found. Consider SPF/DKIM/DMARC for the domain if you manage it.')
      }

      let riskLevel: EmailAnalysisResult['riskLevel'] = 'low'
      if (risk >= 75) riskLevel = 'critical'
      else if (risk >= 50) riskLevel = 'high'
      else if (risk >= 25) riskLevel = 'medium'

      setResult({
        email: e,
        domain,
        emailrep: emailrep as EmailAnalysisResult['emailrep'],
        breachdirectory: breachdirectory as EmailAnalysisResult['breachdirectory'],
        ipqsEmail: ipqsEmail as EmailAnalysisResult['ipqsEmail'],
        hunter: hunter as EmailAnalysisResult['hunter'],
        emailAuth: emailAuth as EmailAnalysisResult['emailAuth'],
        recommendations,
        riskLevel,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const riskClass = {
    low: 'text-green-400 bg-green-950/20 border-green-800/50',
    medium: 'text-yellow-400 bg-yellow-950/20 border-yellow-800/50',
    high: 'text-orange-400 bg-orange-950/20 border-orange-800/50',
    critical: 'text-red-400 bg-red-950/20 border-red-800/50',
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure sends={['email address']} />

      <div>
        <h1 className="text-2xl font-bold">Email Analysis</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Run one email through reputation, breach, verification, Hunter, and domain auth (SPF/DKIM/DMARC) in a single step.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Email address</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            placeholder="user@example.com"
            className="input flex-1 font-mono"
          />
          <button onClick={handleAnalyze} disabled={loading || !email.trim()} className="btn-primary">
            {loading ? 'Running all checks…' : 'Run all checks'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card bg-red-950/20 border-red-900/50 p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="email-analysis"
              input={result.email}
              data={result}
              category="Email Security"
            />
          </div>

          {/* Summary */}
          <div className={`card p-4 border ${riskClass[result.riskLevel]}`}>
            <h2 className="font-semibold mb-2">Summary</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>Risk: <strong className="capitalize">{result.riskLevel}</strong></span>
              <span className="text-gray-500">|</span>
              <span className="font-mono">{result.email}</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
              {result.recommendations.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </div>

          {/* EmailRep */}
          <OutputCard title="EmailRep.io — Reputation" canCopy={!result.emailrep?.error}>
            {result.emailrep?.error ? (
              <p className="text-amber-400 text-sm">{result.emailrep.error}</p>
            ) : (
              <div className="space-y-0">
                {row('Reputation', (result.emailrep as { reputation?: string })?.reputation ?? '—')}
                {row('Suspicious', (result.emailrep as { suspicious?: boolean })?.suspicious ? 'Yes' : 'No', !(result.emailrep as { suspicious?: boolean })?.suspicious)}
                {row('References', String((result.emailrep as { references?: number })?.references ?? 0))}
                {(result.emailrep as { details?: { credentials_leaked?: boolean; data_breach?: boolean } })?.details?.credentials_leaked && (
                  <p className="text-red-400 text-xs mt-2">⚠ Credentials leaked</p>
                )}
                {(result.emailrep as { details?: { data_breach?: boolean } })?.details?.data_breach && (
                  <p className="text-amber-400 text-xs">⚠ Data breach</p>
                )}
              </div>
            )}
          </OutputCard>

          {/* Breach */}
          <OutputCard title="Breach check" canCopy={!result.breachdirectory?.error}>
            {result.breachdirectory?.error ? (
              <p className="text-amber-400 text-sm">{result.breachdirectory.error}</p>
            ) : (
              <div className="space-y-0">
                {row('Found in breaches', (result.breachdirectory as { found?: boolean })?.found ? `Yes (${(result.breachdirectory as { count?: number }).count ?? 0})` : 'No', !(result.breachdirectory as { found?: boolean })?.found)}
                {(result.breachdirectory as { breaches?: string[] })?.breaches?.length ? (
                  <div className="mt-2 text-xs text-gray-400">
                    {(result.breachdirectory as { breaches: string[] }).breaches.slice(0, 5).join(', ')}
                    {(result.breachdirectory as { breaches: string[] }).breaches.length > 5 && ' …'}
                  </div>
                ) : null}
              </div>
            )}
          </OutputCard>

          {/* IPQS Email */}
          <OutputCard title="IPQualityScore — Verification" canCopy={!result.ipqsEmail?.error}>
            {result.ipqsEmail?.error ? (
              <p className="text-amber-400 text-sm">{result.ipqsEmail.error}</p>
            ) : (
              <div className="space-y-0">
                {row('Valid', (result.ipqsEmail as { valid?: boolean })?.valid ? 'Yes' : 'No', (result.ipqsEmail as { valid?: boolean })?.valid)}
                {row('Deliverability', (result.ipqsEmail as { deliverability?: string })?.deliverability ?? '—')}
                {row('Overall score', (result.ipqsEmail as { overall_score?: number })?.overall_score != null ? `${(result.ipqsEmail as { overall_score: number }).overall_score}/100` : '—')}
                {row('Disposable', (result.ipqsEmail as { disposable?: boolean })?.disposable ? 'Yes' : 'No', !(result.ipqsEmail as { disposable?: boolean })?.disposable)}
                {row('Honeypot', (result.ipqsEmail as { honeypot?: boolean })?.honeypot ? 'Yes' : 'No', !(result.ipqsEmail as { honeypot?: boolean })?.honeypot)}
              </div>
            )}
          </OutputCard>

          {/* Hunter */}
          <OutputCard title="Hunter.io — Verification" canCopy={!result.hunter?.error}>
            {result.hunter?.error ? (
              <p className="text-amber-400 text-sm">{result.hunter.error}</p>
            ) : (result.hunter as { data?: { result?: string; score?: number } })?.data ? (
              <div className="space-y-0">
                {row('Result', (result.hunter as { data: { result?: string } }).data.result ?? '—')}
                {row('Score', (result.hunter as { data: { score?: number } }).data.score != null ? `${(result.hunter as { data: { score: number } }).data.score}%` : '—')}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No verification data returned.</p>
            )}
          </OutputCard>

          {/* Domain auth (SPF/DKIM/DMARC) */}
          <OutputCard title="Domain auth (SPF/DKIM/DMARC)" canCopy={!result.emailAuth?.error}>
            {result.emailAuth?.error ? (
              <p className="text-amber-400 text-sm">{result.emailAuth.error}</p>
            ) : (
              <div className="space-y-0">
                {row('Grade', (result.emailAuth as { grade?: string })?.grade ?? '—')}
                {row('SPF', (result.emailAuth as { spf?: { found?: boolean } })?.spf?.found ? 'Found' : 'Not found', (result.emailAuth as { spf?: { found?: boolean } })?.spf?.found)}
                {row('DMARC', (result.emailAuth as { dmarc?: { found?: boolean } })?.dmarc?.found ? 'Found' : 'Not found', (result.emailAuth as { dmarc?: { found?: boolean } })?.dmarc?.found)}
                {row('DKIM', (result.emailAuth as { dkim?: { found?: boolean } })?.dkim?.found ? 'Found' : 'Not found', (result.emailAuth as { dkim?: { found?: boolean } })?.dkim?.found)}
              </div>
            )}
          </OutputCard>
        </div>
      )}

      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About Email Analysis</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Single input runs: EmailRep, Breach check, IPQS Email, Hunter, and SPF/DKIM/DMARC for the domain.</li>
          <li>• Some sources require API keys (IPQS, Hunter). If unset, that card shows an error; others still run.</li>
          <li>• Use for due diligence on signups, investigations, or checking your own domain's auth.</li>
        </ul>
      </div>

      {/* Related Resources */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <span>📚</span>
          <span>Related Resources</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <a
            href="https://haveibeenpwned.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-blue-400 hover:text-blue-300"
          >
            <span className="text-xs">↗</span>
            <div>
              <div className="font-medium">Have I Been Pwned</div>
              <div className="text-xs text-gray-500">Check for breached emails</div>
            </div>
          </a>
          <a
            href="https://emailrep.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-blue-400 hover:text-blue-300"
          >
            <span className="text-xs">↗</span>
            <div>
              <div className="font-medium">EmailRep</div>
              <div className="text-xs text-gray-500">Email reputation scoring</div>
            </div>
          </a>
          <a
            href="https://dmarcian.com/what-is-spf/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-blue-400 hover:text-blue-300"
          >
            <span className="text-xs">↗</span>
            <div>
              <div className="font-medium">DMARCian SPF Guide</div>
              <div className="text-xs text-gray-500">Email authentication docs</div>
            </div>
          </a>
          <a
            href="https://hunter.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-blue-400 hover:text-blue-300"
          >
            <span className="text-xs">↗</span>
            <div>
              <div className="font-medium">Hunter.io</div>
              <div className="text-xs text-gray-500">Find and verify emails</div>
            </div>
          </a>
          <a
            href="https://www.phishtool.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-blue-400 hover:text-blue-300"
          >
            <span className="text-xs">↗</span>
            <div>
              <div className="font-medium">PhishTool</div>
              <div className="text-xs text-gray-500">Phishing analysis platform</div>
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
