/**
 * ==============================================================================
 * NETKNIFE - IPQUALITYSCORE URL SCANNER TOOL
 * ==============================================================================
 * 
 * Malicious URL scanner and reputation using IPQualityScore.
 * ==============================================================================
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import RemoteDisclosure from '../../components/RemoteDisclosure'

interface IPQSUrlResult {
  success?: boolean
  unsafe?: boolean
  domain?: string
  ip_address?: string
  country_code?: string
  server?: string
  content_type?: string
  status_code?: number
  page_size?: number
  domain_rank?: number
  dns_valid?: boolean
  suspicious?: boolean
  phishing?: boolean
  malware?: boolean
  spamming?: boolean
  parking?: boolean
  malicious?: boolean
  risk_score?: number
  message?: string
  cached?: boolean
}

export default function IpqsUrlTool() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IPQSUrlResult | null>(null)
  const [error, setError] = useState('')

  async function handleScan() {
    if (!url) {
      setError('Please enter a URL')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await apiClient.post<IPQSUrlResult>('/ipqs-url', { url })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to scan URL')
    } finally {
      setLoading(false)
    }
  }

  function getRiskScoreColor(score: number) {
    if (score < 25) return 'text-green-400'
    if (score < 75) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure sends={['URL']} />

      <div>
        <label className="block text-sm font-medium mb-2">URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleScan()}
            placeholder="https://example.com"
            className="input flex-1 font-mono"
          />
          <button
            onClick={handleScan}
            disabled={loading || !url}
            className="btn-primary"
          >
            {loading ? 'Scanning...' : 'Scan URL'}
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
          {/* Add to Report Button */}
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="ipqs-url"
              input={url}
              data={result}
              category="Threat Intelligence"
            />
          </div>
          <OutputCard title="URL Information" canCopy={true}>
            <div className="space-y-3">
              {result.domain && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Domain:</span>
                  <span className="text-sm font-mono">{result.domain}</span>
                </div>
              )}
              {result.ip_address && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">IP Address:</span>
                  <span className="text-sm font-mono">{result.ip_address}</span>
                </div>
              )}
              {result.country_code && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Country:</span>
                  <span className="text-sm">{result.country_code}</span>
                </div>
              )}
              {result.server && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Server:</span>
                  <span className="text-sm">{result.server}</span>
                </div>
              )}
              {result.status_code && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">HTTP Status:</span>
                  <span className="text-sm">{result.status_code}</span>
                </div>
              )}
              {result.domain_rank !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Domain Rank:</span>
                  <span className="text-sm">{result.domain_rank}</span>
                </div>
              )}
            </div>
          </OutputCard>

          <OutputCard title="Security Assessment" canCopy={true}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Unsafe:</span>
                <span className={result.unsafe ? 'text-red-400' : 'text-green-400'}>
                  {result.unsafe ? 'Yes' : 'No'}
                </span>
              </div>
              {result.risk_score !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Risk Score:</span>
                  <span className={`font-medium ${getRiskScoreColor(result.risk_score)}`}>
                    {result.risk_score}/100
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Malicious:</span>
                <span className={result.malicious ? 'text-red-400' : 'text-green-400'}>
                  {result.malicious ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Phishing:</span>
                <span className={result.phishing ? 'text-red-400' : 'text-green-400'}>
                  {result.phishing ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Malware:</span>
                <span className={result.malware ? 'text-red-400' : 'text-green-400'}>
                  {result.malware ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Suspicious:</span>
                <span className={result.suspicious ? 'text-yellow-400' : 'text-green-400'}>
                  {result.suspicious ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Spamming:</span>
                <span className={result.spamming ? 'text-red-400' : 'text-green-400'}>
                  {result.spamming ? 'Yes' : 'No'}
                </span>
              </div>
              {result.dns_valid !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">DNS Valid:</span>
                  <span className={result.dns_valid ? 'text-green-400' : 'text-red-400'}>
                    {result.dns_valid ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
              {(result.malicious || result.phishing || result.malware || result.unsafe) && (
                <div className="mt-3 p-2 bg-red-950/20 border border-red-900/50 rounded">
                  <p className="text-red-400 text-xs">
                    ⚠️ This URL has been flagged as potentially dangerous
                  </p>
                </div>
              )}
            </div>
          </OutputCard>
        </div>
      )}

      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About IPQualityScore URL Scanner</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Free tier: 1,000 requests/month</li>
          <li>• Scans URLs for phishing, malware, and suspicious content</li>
          <li>• Risk score: 0-100 (lower is better)</li>
          <li>• Uses fast mode (lighter scan for speed)</li>
          <li>• Provides domain and server information</li>
        </ul>
      </div>
    </div>
  )
}
