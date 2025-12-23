/**
 * ==============================================================================
 * NETKNIFE - JWT DECODER TOOL
 * ==============================================================================
 * 
 * Decode and inspect JWT (JSON Web Tokens) without validation.
 * Useful for debugging authentication issues.
 * 
 * FEATURES:
 * - Decode header and payload
 * - Display claims with human-readable timestamps
 * - Show token expiration status
 * - Copy decoded sections
 * 
 * All decoding happens client-side - tokens never leave the browser.
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import OutputCard from '../../components/OutputCard'

/**
 * Decodes a Base64URL string (JWT uses Base64URL, not standard Base64)
 */
function base64UrlDecode(str: string): string {
  // Replace Base64URL characters with Base64 equivalents
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  // Pad with '=' to make length multiple of 4
  while (base64.length % 4 !== 0) {
    base64 += '='
  }
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch {
    return atob(base64)
  }
}

/**
 * Formats Unix timestamp to human-readable date
 */
function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000)
  return date.toLocaleString() + ' (' + date.toISOString() + ')'
}

/**
 * Known JWT claim descriptions
 */
const CLAIM_DESCRIPTIONS: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expiration Time',
  nbf: 'Not Before',
  iat: 'Issued At',
  jti: 'JWT ID',
  name: 'Full Name',
  email: 'Email',
  email_verified: 'Email Verified',
  phone_number: 'Phone Number',
  picture: 'Profile Picture URL',
  given_name: 'First Name',
  family_name: 'Last Name',
  locale: 'Locale',
  zoneinfo: 'Timezone',
  nonce: 'Nonce',
  auth_time: 'Authentication Time',
  at_hash: 'Access Token Hash',
  c_hash: 'Code Hash',
  acr: 'Authentication Context Class',
  amr: 'Authentication Methods',
  azp: 'Authorized Party',
  sid: 'Session ID',
  'cognito:username': 'Cognito Username',
  'cognito:groups': 'Cognito Groups',
  token_use: 'Token Use',
  scope: 'Scope',
}

export default function JwtDecoderTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')

  const decoded = useMemo(() => {
    if (!input.trim()) return null

    try {
      const parts = input.trim().split('.')
      if (parts.length !== 3) {
        return { error: 'Invalid JWT format. Expected 3 parts separated by dots.' }
      }

      const [headerB64, payloadB64, signature] = parts

      // Decode header
      let header: Record<string, unknown>
      try {
        header = JSON.parse(base64UrlDecode(headerB64))
      } catch {
        return { error: 'Failed to decode JWT header' }
      }

      // Decode payload
      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(base64UrlDecode(payloadB64))
      } catch {
        return { error: 'Failed to decode JWT payload' }
      }

      // Check expiration
      let expirationStatus = 'No expiration claim'
      if (typeof payload.exp === 'number') {
        const now = Math.floor(Date.now() / 1000)
        const diff = payload.exp - now
        if (diff < 0) {
          expirationStatus = `EXPIRED (${Math.abs(Math.floor(diff / 60))} minutes ago)`
        } else if (diff < 300) {
          expirationStatus = `Expires in ${diff} seconds`
        } else if (diff < 3600) {
          expirationStatus = `Expires in ${Math.floor(diff / 60)} minutes`
        } else if (diff < 86400) {
          expirationStatus = `Expires in ${Math.floor(diff / 3600)} hours`
        } else {
          expirationStatus = `Expires in ${Math.floor(diff / 86400)} days`
        }
      }

      return {
        header,
        payload,
        signature: signature.substring(0, 20) + '...',
        signatureLength: signature.length,
        expirationStatus,
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to decode JWT' }
    }
  }, [input])

  function handleDecode() {
    if (!decoded) {
      setOutput('Enter a JWT token above')
      return
    }
    if ('error' in decoded) {
      setOutput(JSON.stringify({ error: decoded.error }, null, 2))
      return
    }

    const result = {
      header: decoded.header,
      payload: decoded.payload,
      expiration: decoded.expirationStatus,
      signature: {
        preview: decoded.signature,
        length: decoded.signatureLength,
      },
    }
    setOutput(JSON.stringify(result, null, 2))
  }

  function loadExample() {
    // Example JWT (expired, for demonstration)
    const exampleJwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFiYzEyMyJ9.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJzdWIiOiJ1c2VyMTIzIiwiYXVkIjoibXktYXBwIiwiZXhwIjoxNzAzMjcyMDAwLCJpYXQiOjE3MDMyNjg0MDAsIm5hbWUiOiJKb2huIERvZSIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJyb2xlcyI6WyJhZG1pbiIsInVzZXIiXX0.fake_signature_for_demo'
    setInput(exampleJwt)
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            Tokens are decoded locally. No data is sent to any server.
          </span>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">JWT Token</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your JWT token here (e.g., eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.Rq8IjqbeYa...)"
            className="input font-mono text-sm min-h-[100px]"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={handleDecode} className="btn-primary">
            Decode
          </button>
          <button onClick={loadExample} className="btn-secondary">
            Example
          </button>
        </div>
      </div>

      {/* Live preview */}
      {decoded && !('error' in decoded) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Header */}
          <div className="card p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Header</h4>
            <pre className="text-xs text-gray-300 overflow-auto">
              {JSON.stringify(decoded.header, null, 2)}
            </pre>
          </div>

          {/* Expiration status */}
          <div className="card p-4">
            <h4 className="text-sm font-medium text-amber-400 mb-2">Status</h4>
            <p className={`text-sm ${
              decoded.expirationStatus.includes('EXPIRED') 
                ? 'text-red-400' 
                : decoded.expirationStatus.includes('seconds')
                  ? 'text-amber-400'
                  : 'text-green-400'
            }`}>
              {decoded.expirationStatus}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Algorithm: {String(decoded.header.alg || 'unknown')}
            </p>
          </div>

          {/* Payload claims */}
          <div className="card p-4 md:col-span-2">
            <h4 className="text-sm font-medium text-purple-400 mb-2">Payload Claims</h4>
            <div className="space-y-2">
              {Object.entries(decoded.payload).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-sm">
                  <span className="font-mono text-blue-300 min-w-[120px]">{key}:</span>
                  <span className="text-gray-300">
                    {typeof value === 'number' && (key === 'exp' || key === 'iat' || key === 'nbf' || key === 'auth_time')
                      ? formatTimestamp(value)
                      : typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                  </span>
                  {CLAIM_DESCRIPTIONS[key] && (
                    <span className="text-gray-500 text-xs">({CLAIM_DESCRIPTIONS[key]})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {decoded && 'error' in decoded && (
        <div className="card bg-red-950/20 border-red-900/50 p-4">
          <p className="text-red-400">{decoded.error}</p>
        </div>
      )}

      {/* Full output */}
      <OutputCard title="Decoded JWT" value={output} />
    </div>
  )
}

