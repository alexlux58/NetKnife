/**
 * ==============================================================================
 * ABUSEIPDB TOOL - IP Reputation Checker
 * ==============================================================================
 * 
 * Checks IP addresses against AbuseIPDB to see if they've been reported
 * for malicious activity (spam, brute-force attacks, DDoS, etc.)
 * 
 * WHAT IT SHOWS:
 * - Abuse Confidence Score (0-100%)
 * - Total reports and distinct reporters
 * - Attack categories (SSH attacks, port scans, etc.)
 * - ISP, country, and usage type
 * - Recent abuse reports
 * ==============================================================================
 */

import { useEffect, useState } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import OutputCard from '../../components/OutputCard'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import AddToReportButton from '../../components/AddToReportButton'
import { apiClient } from '../../lib/api'

// ------------------------------------------------------------------------------
// FORM VALIDATION SCHEMA
// ------------------------------------------------------------------------------

const schema = z.object({
  ip: z.string()
    .min(1, 'IP address is required')
    .refine(
      (val) => {
        // IPv4 validation
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
        // Basic IPv6 validation
        const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
        return ipv4Regex.test(val) || ipv6Regex.test(val)
      },
      { message: 'Invalid IP address format' }
    ),
})

type FormData = z.infer<typeof schema>

// ------------------------------------------------------------------------------
// TYPES
// ------------------------------------------------------------------------------

interface Category {
  id: number
  name: string
}

interface AbuseReport {
  reportedAt: string
  comment: string
  categories: Category[]
  reporterId: number
  reporterCountryCode: string
}

interface ThreatLevel {
  level: string
  color: string
  emoji: string
}

interface AbuseIpDbResult {
  ip: string
  abuseConfidenceScore: number
  threatLevel: ThreatLevel
  totalReports: number
  numDistinctUsers: number
  lastReportedAt: string | null
  countryCode: string
  countryName: string
  isp: string
  domain: string
  usageType: string
  hostnames: string[]
  isTor: boolean
  isWhitelisted: boolean
  categories: Category[]
  recentReports: AbuseReport[]
  cached: boolean
}

// ------------------------------------------------------------------------------
// COMPONENT
// ------------------------------------------------------------------------------

export default function AbuseIpDbTool() {
  const [output, setOutput] = useState('')
  const [result, setResult] = useState<AbuseIpDbResult | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ip: '' },
  })

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('netknife:tool:abuseipdb')
      if (raw) reset(JSON.parse(raw))
    } catch (_) {}
  }, [reset])

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    sessionStorage.setItem('netknife:tool:abuseipdb', JSON.stringify(data))
    setLoading(true)
    setResult(null)
    try {
      const res = await apiClient.post('/abuseipdb', data) as AbuseIpDbResult
      setResult(res)
      setOutput(JSON.stringify(res, null, 2))
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Request failed'
      setOutput(JSON.stringify({ error: errorMessage }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  function loadExample() {
    // Known Tor exit node IP (commonly reported)
    setValue('ip', '185.220.101.1')
  }

  // Determine confidence score color
  function getScoreColor(score: number): string {
    if (score >= 75) return 'text-red-500'
    if (score >= 50) return 'text-orange-500'
    if (score >= 25) return 'text-yellow-500'
    if (score > 0) return 'text-blue-400'
    return 'text-green-500'
  }

  // Determine confidence score background
  function getScoreBg(score: number): string {
    if (score >= 75) return 'bg-red-950/50 border-red-900/50'
    if (score >= 50) return 'bg-orange-950/50 border-orange-900/50'
    if (score >= 25) return 'bg-yellow-950/50 border-yellow-900/50'
    if (score > 0) return 'bg-blue-950/50 border-blue-900/50'
    return 'bg-green-950/50 border-green-900/50'
  }

  return (
    <div className="space-y-6">
      {/* Remote disclosure banner */}
      <RemoteDisclosure
        sends={['IP address']}
        notes="Queries AbuseIPDB API. Results cached for 1 hour to conserve API quota."
      />

      {/* Input form */}
      <div className="card p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              IP Address
            </label>
            <input
              type="text"
              {...register('ip')}
              placeholder="185.220.101.1"
              className="input font-mono"
            />
            {errors.ip && (
              <p className="text-red-400 text-sm mt-1">{errors.ip.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Enter an IPv4 or IPv6 address to check for abuse reports
            </p>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Checking...' : 'Check Reputation'}
            </button>
            <button type="button" onClick={loadExample} className="btn-secondary">
              Example
            </button>
          </div>
        </form>
      </div>

      {/* Results display */}
      {result && (
        <div className="space-y-4">
          {/* Add to Report Button */}
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="abuseipdb"
              input={result.ip}
              data={result}
              category="Threat Intelligence"
            />
          </div>
          {/* Score card */}
          <div className={`card p-6 ${getScoreBg(result.abuseConfidenceScore)}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-mono">{result.ip}</h3>
                <p className="text-gray-400 text-sm">
                  {result.countryName || result.countryCode} • {result.isp}
                </p>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-bold ${getScoreColor(result.abuseConfidenceScore)}`}>
                  {result.abuseConfidenceScore}%
                </div>
                <div className="text-sm text-gray-400">
                  Abuse Confidence
                </div>
              </div>
            </div>

            {/* Threat badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`badge ${getScoreColor(result.abuseConfidenceScore)}`}>
                {result.threatLevel?.emoji} {result.threatLevel?.level.toUpperCase()}
              </span>
              {result.isTor && (
                <span className="badge text-purple-400">🧅 Tor Exit Node</span>
              )}
              {result.isWhitelisted && (
                <span className="badge text-green-400">✓ Whitelisted</span>
              )}
              {result.cached && (
                <span className="badge text-gray-500">Cached</span>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">
                {result.totalReports.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Total Reports</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">
                {result.numDistinctUsers}
              </div>
              <div className="text-sm text-gray-500">Distinct Reporters</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-lg font-mono text-gray-300">
                {result.lastReportedAt 
                  ? new Date(result.lastReportedAt).toLocaleDateString()
                  : 'Never'}
              </div>
              <div className="text-sm text-gray-500">Last Reported</div>
            </div>
          </div>

          {/* Details */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* IP Info */}
            <div className="card p-4">
              <h4 className="font-medium mb-3">IP Information</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Domain</dt>
                  <dd className="font-mono">{result.domain || 'N/A'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Usage Type</dt>
                  <dd>{result.usageType || 'Unknown'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Country</dt>
                  <dd>{result.countryName || result.countryCode}</dd>
                </div>
                {result.hostnames.length > 0 && (
                  <div>
                    <dt className="text-gray-500 mb-1">Hostnames</dt>
                    <dd className="font-mono text-xs">
                      {result.hostnames.slice(0, 3).join(', ')}
                      {result.hostnames.length > 3 && ` +${result.hostnames.length - 3} more`}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Categories */}
            <div className="card p-4">
              <h4 className="font-medium mb-3">Attack Categories</h4>
              {result.categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {result.categories.map((cat) => (
                    <span
                      key={cat.id}
                      className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300"
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No attack categories reported</p>
              )}
            </div>
          </div>

          {/* Recent reports */}
          {result.recentReports.length > 0 && (
            <div className="card p-4">
              <h4 className="font-medium mb-3">Recent Reports</h4>
              <div className="space-y-3">
                {result.recentReports.map((report, idx) => (
                  <div key={idx} className="p-3 bg-gray-900 rounded text-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-gray-400">
                        {new Date(report.reportedAt).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-600">
                        Reporter #{report.reporterId} ({report.reporterCountryCode})
                      </span>
                    </div>
                    {report.comment && (
                      <p className="text-gray-300 mb-2">{report.comment}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {report.categories.map((cat) => (
                        <span
                          key={cat.id}
                          className="px-1.5 py-0.5 text-xs rounded bg-gray-800 text-gray-400"
                        >
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Raw output */}
      <OutputCard title="Raw Response" value={output} />

      {/* Reference info */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">Confidence Score Guide</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          <div className="p-2 rounded bg-green-950/30">
            <div className="text-green-500 font-bold">0%</div>
            <div className="text-xs text-gray-500">Clean</div>
          </div>
          <div className="p-2 rounded bg-blue-950/30">
            <div className="text-blue-400 font-bold">1-24%</div>
            <div className="text-xs text-gray-500">Low</div>
          </div>
          <div className="p-2 rounded bg-yellow-950/30">
            <div className="text-yellow-500 font-bold">25-49%</div>
            <div className="text-xs text-gray-500">Medium</div>
          </div>
          <div className="p-2 rounded bg-orange-950/30">
            <div className="text-orange-500 font-bold">50-74%</div>
            <div className="text-xs text-gray-500">High</div>
          </div>
          <div className="p-2 rounded bg-red-950/30">
            <div className="text-red-500 font-bold">75-100%</div>
            <div className="text-xs text-gray-500">Critical</div>
          </div>
        </div>
      </div>
    </div>
  )
}

