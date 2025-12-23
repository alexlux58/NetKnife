/**
 * ==============================================================================
 * NETKNIFE - TLS INSPECTOR TOOL
 * ==============================================================================
 * 
 * Inspects TLS certificates for any host and port.
 * 
 * FEATURES:
 * - Certificate chain inspection
 * - Expiry date and days remaining
 * - Subject Alternative Names (SANs)
 * - SHA-256 fingerprints
 * - Key type and size
 * - Signature algorithm
 * 
 * NOTE: This is a REMOTE tool - connections are made from AWS Lambda.
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import { apiPost, ApiError } from '../../lib/api'

interface Certificate {
  subject: string
  issuer: string
  validFrom: string
  validTo: string
  daysRemaining: number
  serialNumber: string
  signatureAlgorithm: string
  keyType: string
  keySize: number
  fingerprint: string
  sans: string[]
}

interface TlsResult {
  host: string
  port: number
  protocol: string
  cipher: string
  chain: Certificate[]
}

export default function TlsTool() {
  const [host, setHost] = useState('example.com')
  const [port, setPort] = useState('443')
  const [sni, setSni] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TlsResult | null>(null)
  const [error, setError] = useState('')

  async function handleInspect() {
    setLoading(true)
    setError('')
    setResult(null)
    
    try {
      const res = await apiPost('/tls', {
        host,
        port: Number(port),
        sni: sni || host,
      }) as TlsResult
      setResult(res)
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`Error ${e.status}: ${JSON.stringify(e.body, null, 2)}`)
      } else {
        setError(String(e))
      }
    } finally {
      setLoading(false)
    }
  }

  function loadExample() {
    setHost('github.com')
    setPort('443')
    setSni('')
  }

  // Get color based on days remaining
  function getDaysColor(days: number): string {
    if (days < 0) return 'text-red-500 bg-red-950/50'
    if (days < 14) return 'text-red-400 bg-red-950/30'
    if (days < 30) return 'text-orange-400 bg-orange-950/30'
    if (days < 60) return 'text-yellow-400 bg-yellow-950/30'
    return 'text-green-400 bg-green-950/30'
  }

  return (
    <div className="space-y-6">
      {/* Remote disclosure */}
      <RemoteDisclosure
        sends={['Hostname', 'Port', 'SNI hostname']}
        notes="Lambda connects to the target and retrieves certificate chain. Inspects even invalid/expired certs."
      />

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          {/* Host input */}
          <div>
            <label className="block text-sm font-medium mb-2">Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="example.com"
              className="input font-mono"
            />
          </div>

          {/* Port input */}
          <div>
            <label className="block text-sm font-medium mb-2">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="443"
              className="input font-mono w-32"
            />
          </div>

          {/* SNI input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              SNI (optional)
            </label>
            <input
              type="text"
              value={sni}
              onChange={(e) => setSni(e.target.value)}
              placeholder={host || 'Same as host'}
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Server Name Indication - useful for shared hosting
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleInspect}
              disabled={loading || !host}
              className="btn-primary"
            >
              {loading ? 'Inspecting...' : 'Inspect Certificate'}
            </button>
            <button onClick={loadExample} className="btn-secondary">
              Example
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="card bg-red-950/30 border-red-900/50 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Common ports */}
          <div className="card p-4 text-sm">
            <h4 className="font-medium mb-2">Common TLS Ports</h4>
            <div className="grid grid-cols-2 gap-2 text-gray-400">
              <div>443 - HTTPS</div>
              <div>465 - SMTPS</div>
              <div>636 - LDAPS</div>
              <div>993 - IMAPS</div>
              <div>995 - POP3S</div>
              <div>8443 - Alt HTTPS</div>
            </div>
          </div>
        </div>

        {/* Output section */}
        <div className="space-y-4">
          {result && (
            <>
              {/* Connection summary */}
              <div className="card p-4">
                <h4 className="font-medium mb-3">Connection</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Host:</span>
                    <span className="ml-2 font-mono">{result.host}:{result.port}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Protocol:</span>
                    <span className="ml-2 text-green-400">{result.protocol}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Cipher:</span>
                    <span className="ml-2 font-mono text-xs">{result.cipher}</span>
                  </div>
                </div>
              </div>

              {/* Certificate chain */}
              {result.chain?.map((cert, idx) => (
                <div key={idx} className="card overflow-hidden">
                  <div className="p-3 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-400">
                        {idx === 0 ? '🔐 Leaf Certificate' : idx === result.chain.length - 1 ? '🏛️ Root CA' : '📜 Intermediate'}
                      </span>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${getDaysColor(cert.daysRemaining)}`}>
                      {cert.daysRemaining < 0 
                        ? `Expired ${Math.abs(cert.daysRemaining)} days ago`
                        : `${cert.daysRemaining} days remaining`
                      }
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    {/* Subject & Issuer */}
                    <div className="grid gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Subject</span>
                        <span className="font-mono text-cyan-400">{cert.subject}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Issuer</span>
                        <span className="font-mono text-gray-300">{cert.issuer}</span>
                      </div>
                    </div>

                    {/* Validity */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Valid From</span>
                        <span>{new Date(cert.validFrom).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Valid To</span>
                        <span className={cert.daysRemaining < 30 ? 'text-orange-400' : ''}>
                          {new Date(cert.validTo).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Technical details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Key</span>
                        <span>{cert.keyType} {cert.keySize}-bit</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Signature</span>
                        <span className="text-xs">{cert.signatureAlgorithm}</span>
                      </div>
                    </div>

                    {/* SANs (only for leaf cert) */}
                    {idx === 0 && cert.sans?.length > 0 && (
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-2">
                          Subject Alternative Names ({cert.sans.length})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {cert.sans.slice(0, 10).map((san, i) => (
                            <span key={i} className="px-2 py-0.5 text-xs rounded bg-gray-800 font-mono">
                              {san}
                            </span>
                          ))}
                          {cert.sans.length > 10 && (
                            <span className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-500">
                              +{cert.sans.length - 10} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Fingerprint */}
                    <div>
                      <span className="text-gray-500 block text-xs uppercase mb-1">SHA-256 Fingerprint</span>
                      <span className="font-mono text-xs text-gray-400 break-all">{cert.fingerprint}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Full JSON result */}
              <JsonViewer data={result} title="Full Response" defaultView="raw" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
