/**
 * ==============================================================================
 * NETKNIFE - GREYNOISE TOOL
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'

interface GreyNoiseResult {
  ip: string
  noise: boolean
  riot: boolean
  classification: 'benign' | 'malicious' | 'unknown'
  name?: string
  link?: string
  lastSeen?: string
  message?: string
}

export default function GreyNoiseTool() {
  const [ip, setIp] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GreyNoiseResult | null>(null)
  const [error, setError] = useState('')

  async function handleCheck() {
    setLoading(true)
    setError('')
    setResult(null)
    
    try {
      const data = await apiPost<GreyNoiseResult>('/greynoise', { ip })
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

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'benign': return 'text-emerald-400 bg-emerald-400/20'
      case 'malicious': return 'text-red-400 bg-red-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GreyNoise</h1>
        <p className="text-gray-400 mt-1">
          Internet scanner and background noise detection
        </p>
      </div>

      <RemoteDisclosure 
        sends={['IP address']} 
        notes="Requires GreyNoise API key. Identifies known scanners, bots, and benign services."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">IP Address</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="8.8.8.8"
              className="input font-mono"
            />
          </div>
          <button onClick={handleCheck} disabled={loading || !ip} className="btn btn-primary w-full">
            {loading ? 'Checking...' : 'Check GreyNoise'}
          </button>
          
          <div className="text-sm text-gray-500">
            <p className="mb-2">GreyNoise tracks IPs that mass-scan the internet:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><span className="text-emerald-400">Benign</span> - Known security researchers, search engines</li>
              <li><span className="text-red-400">Malicious</span> - Known malware, exploit scanners</li>
              <li><span className="text-gray-400">Unknown</span> - Not seen scanning</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          {result && (
            <>
              {/* Add to Report Button */}
              <div className="flex items-center justify-end">
                <AddToReportButton
                  toolId="greynoise"
                  input={ip}
                  data={result}
                  category="Threat Intelligence"
                />
              </div>
              <div className="card p-6">
              <div className="text-center mb-6">
                <div className={`inline-block text-2xl font-bold px-6 py-3 rounded-lg uppercase ${getClassificationColor(result.classification)}`}>
                  {result.classification}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-center mb-4">
                <div className={`p-3 rounded-lg ${result.noise ? 'bg-yellow-500/20' : 'bg-[#161b22]'}`}>
                  <div className="text-lg">{result.noise ? '📢' : '🔇'}</div>
                  <div className="text-sm font-medium">{result.noise ? 'Internet Noise' : 'No Noise'}</div>
                  <div className="text-xs text-gray-500">
                    {result.noise ? 'Seen scanning the internet' : 'Not observed scanning'}
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${result.riot ? 'bg-emerald-500/20' : 'bg-[#161b22]'}`}>
                  <div className="text-lg">{result.riot ? '✓' : '?'}</div>
                  <div className="text-sm font-medium">{result.riot ? 'RIOT Tag' : 'Not RIOT'}</div>
                  <div className="text-xs text-gray-500">
                    {result.riot ? 'Known benign service' : 'Not a known service'}
                  </div>
                </div>
              </div>
              
              {result.name && (
                <div className="text-center mb-4">
                  <div className="text-sm text-gray-500">Identified As</div>
                  <div className="text-lg font-medium">{result.name}</div>
                </div>
              )}
              
              {result.lastSeen && (
                <div className="text-center text-sm text-gray-500">
                  Last seen: {new Date(result.lastSeen).toLocaleDateString()}
                </div>
              )}
              
              {result.link && (
                <div className="text-center mt-4">
                  <a 
                    href={result.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm"
                  >
                    View on GreyNoise →
                  </a>
                </div>
              )}
              
              {result.message && (
                <div className="mt-4 p-3 bg-[#161b22] rounded text-sm text-gray-400">
                  {result.message}
                </div>
              )}
              </div>
            </>
          )}

          <JsonViewer title="Raw Response" json={result} error={error} />
        </div>
      </div>
    </div>
  )
}

