/**
 * ==============================================================================
 * NETKNIFE - VIRUSTOTAL TOOL
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'

interface VtResult {
  type: string
  value: string
  lastAnalysisStats?: {
    malicious: number
    suspicious: number
    undetected: number
    harmless: number
  }
  reputation?: number
  categories?: Record<string, string>
  asOwner?: string
  country?: string
  lastAnalysisResults?: { engine: string; category: string; result: string }[]
}

export default function VirusTotalTool() {
  const [type, setType] = useState<'ip' | 'domain' | 'url'>('ip')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VtResult | null>(null)
  const [error, setError] = useState('')

  async function handleCheck() {
    setLoading(true)
    setError('')
    setResult(null)
    
    try {
      const data = await apiPost<VtResult>('/virustotal', { type, value })
      setResult(data)
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`Error ${e.status}: ${formatJson(e.body)}`)
      } else {
        setError(String(e))
      }
    } finally {
      setLoading(false)
    }
  }

  const stats = result?.lastAnalysisStats
  const total = stats ? stats.malicious + stats.suspicious + stats.undetected + stats.harmless : 0
  const threatPercent = stats && total > 0 ? ((stats.malicious + stats.suspicious) / total) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">VirusTotal</h1>
        <p className="text-gray-400 mt-1">
          Multi-engine malware and threat analysis
        </p>
      </div>

      <RemoteDisclosure 
        sends={['IP, domain, or URL']} 
        notes="Requires VirusTotal API key. Free tier: 4 requests/minute, 500/day."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['ip', 'domain', 'url'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`py-2 rounded text-sm font-medium transition-colors ${
                    type === t ? 'bg-blue-500 text-white' : 'bg-[#21262d] text-gray-400'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">{type.toUpperCase()}</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === 'ip' ? '8.8.8.8' : type === 'domain' ? 'example.com' : 'https://example.com'}
              className="input font-mono"
            />
          </div>
          <button onClick={handleCheck} disabled={loading || !value} className="btn btn-primary w-full">
            {loading ? 'Scanning...' : 'Check VirusTotal'}
          </button>
        </div>

        <div className="space-y-4">
          {result && (
            <>
              {/* Add to Report Button */}
              {stats && (
                <div className="flex items-center justify-end">
                  <AddToReportButton
                    toolId="virustotal"
                    input={value}
                    data={result}
                    category="Threat Intelligence"
                  />
                </div>
              )}
              {stats && (
            <div className={`card p-6 border-l-4 ${
              threatPercent > 10 ? 'border-red-500' : threatPercent > 0 ? 'border-yellow-500' : 'border-emerald-500'
            }`}>
              <div className="text-center mb-4">
                <div className={`text-4xl font-bold ${
                  threatPercent > 10 ? 'text-red-400' : threatPercent > 0 ? 'text-yellow-400' : 'text-emerald-400'
                }`}>
                  {stats.malicious + stats.suspicious} / {total}
                </div>
                <div className="text-gray-500">security vendors flagged this</div>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div>
                  <div className="text-red-400 font-bold">{stats.malicious}</div>
                  <div className="text-xs text-gray-500">Malicious</div>
                </div>
                <div>
                  <div className="text-yellow-400 font-bold">{stats.suspicious}</div>
                  <div className="text-xs text-gray-500">Suspicious</div>
                </div>
                <div>
                  <div className="text-gray-400 font-bold">{stats.undetected}</div>
                  <div className="text-xs text-gray-500">Undetected</div>
                </div>
                <div>
                  <div className="text-emerald-400 font-bold">{stats.harmless}</div>
                  <div className="text-xs text-gray-500">Harmless</div>
                </div>
              </div>
            </div>
          )}

          {result?.lastAnalysisResults && result.lastAnalysisResults.length > 0 && (
            <div className="card p-4">
              <h3 className="font-medium mb-2 text-red-400">Detections</h3>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {result.lastAnalysisResults.map((r, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-[#21262d]">
                    <span className="text-gray-400">{r.engine}</span>
                    <span className="text-red-400">{r.result}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result?.categories && Object.keys(result.categories).length > 0 && (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.categories).map(([vendor, cat]) => (
                  <span key={vendor} className="px-2 py-1 bg-[#21262d] rounded text-xs">
                    {cat}
                  </span>
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

