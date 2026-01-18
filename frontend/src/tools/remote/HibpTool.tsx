/**
 * ==============================================================================
 * NETKNIFE - HAVE I BEEN PWNED PASSWORD CHECKER
 * ==============================================================================
 * 
 * Check if a password has appeared in known data breaches using the
 * Have I Been Pwned API with k-anonymity for maximum privacy.
 * 
 * HOW IT WORKS:
 * 1. Password is hashed (SHA-1) entirely in your browser
 * 2. Only first 5 characters of hash are sent to the server
 * 3. Server returns all matching hash suffixes
 * 4. Browser checks if full hash appears in results
 * 
 * YOUR PASSWORD NEVER LEAVES YOUR BROWSER!
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import { apiClient } from '../../lib/api'

/**
 * SHA-1 hash using Web Crypto API
 */
async function sha1(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

interface HibpResult {
  hashPrefix: string
  totalSuffixes: number
  totalBreaches: number
  suffixes: string[]
  cached: boolean
}

export default function HibpTool() {
  const [password, setPassword] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    found: boolean
    count: number
    hash: string
  } | null>(null)

  async function handleCheck() {
    if (!password) {
      setOutput(JSON.stringify({ error: 'Enter a password to check' }, null, 2))
      return
    }

    setLoading(true)
    setResult(null)

    try {
      // Hash password locally
      const hash = await sha1(password)
      const prefix = hash.substring(0, 5)
      const suffix = hash.substring(5)

      // Query API with only the prefix (k-anonymity)
      const res = await apiClient.post('/hibp', { hashPrefix: prefix }) as HibpResult

      // Check if our suffix appears in the results
      const match = res.suffixes.find(s => s.startsWith(suffix))
      const count = match ? parseInt(match.split(':')[1], 10) : 0

      setResult({
        found: count > 0,
        count,
        hash,
      })

      setOutput(JSON.stringify({
        password: '***REDACTED***',
        hashPrefix: prefix,
        hashSuffix: suffix.substring(0, 10) + '...',
        found: count > 0,
        breachCount: count,
        message: count > 0
          ? `⚠️ This password appeared in ${count.toLocaleString()} data breaches!`
          : '✓ This password was not found in any known breaches.',
        cached: res.cached,
      }, null, 2))

    } catch (e) {
      setOutput(JSON.stringify({ error: e instanceof Error ? e.message : 'Request failed' }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Privacy notice */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-green-400 text-lg">🔒</span>
            <span className="font-medium text-green-400">Privacy First</span>
          </div>
          <p className="text-sm text-gray-400">
            Your password is hashed <strong>in your browser</strong> using SHA-1.
            Only the first 5 characters of the hash are sent to check against breaches.
            <strong className="text-green-400"> Your actual password never leaves your device.</strong>
          </p>
        </div>
      </div>

      {/* Remote indicator */}
      <div className="card bg-blue-950/20 border-blue-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-remote">REMOTE</span>
          <span className="text-sm text-gray-400">
            Uses k-anonymity API via AWS Lambda → Have I Been Pwned.
          </span>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Password to Check</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to check..."
            className="input font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          />
          <p className="text-xs text-gray-500 mt-1">
            Type a password and press Enter or click Check
          </p>
        </div>

        <button
          onClick={handleCheck}
          disabled={loading || !password}
          className="btn-primary"
        >
          {loading ? 'Checking...' : 'Check Password'}
        </button>
      </div>

      {/* Result display */}
      {result && (
        <div className={`card p-6 text-center ${
          result.found ? 'bg-red-950/30 border-red-900/50' : 'bg-green-950/30 border-green-900/50'
        }`}>
          <div className={`text-5xl mb-4 ${result.found ? 'text-red-400' : 'text-green-400'}`}>
            {result.found ? '⚠️' : '✓'}
          </div>
          <h3 className={`text-xl font-bold ${result.found ? 'text-red-400' : 'text-green-400'}`}>
            {result.found ? 'Password Found in Breaches!' : 'Password Not Found'}
          </h3>
          {result.found ? (
            <p className="text-gray-400 mt-2">
              This password appeared in <strong className="text-red-300">
                {result.count.toLocaleString()}
              </strong> data breaches.
              <br />
              <span className="text-red-400">Do not use this password!</span>
            </p>
          ) : (
            <p className="text-gray-400 mt-2">
              This password was not found in any known data breaches.
              <br />
              <span className="text-amber-400">This doesn't guarantee it's secure!</span>
            </p>
          )}
        </div>
      )}

      {/* Output */}
      <OutputCard title="Check Result" value={output} />
      
      {result && (
        <div className="flex items-center justify-end">
          <AddToReportButton
            toolId="hibp"
            input="Password check (redacted)"
            data={{ found: result.found, count: result.count, hashPrefix: result.hash.substring(0, 5) + '...' }}
            category="Threat Intelligence"
          />
        </div>
      )}

      {/* How it works */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">How k-Anonymity Works</h4>
        <ol className="list-decimal list-inside space-y-1 text-gray-400 text-xs">
          <li>Your password is hashed with SHA-1: <code className="text-blue-400">password → 5BAA6...</code></li>
          <li>Only first 5 chars sent to API: <code className="text-blue-400">5BAA6</code></li>
          <li>API returns ~500 matching suffixes</li>
          <li>Browser checks if your full suffix exists in results</li>
          <li>Server can't determine which password you checked</li>
        </ol>
        <p className="mt-3 text-gray-500">
          Source: <a href="https://haveibeenpwned.com/API/v3#PwnedPasswords" 
            target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Have I Been Pwned API
          </a>
        </p>
      </div>
    </div>
  )
}

