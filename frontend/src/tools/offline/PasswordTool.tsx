/**
 * ==============================================================================
 * NETKNIFE - PASSWORD GENERATOR TOOL
 * ==============================================================================
 * 
 * Generates cryptographically secure passwords using the Web Crypto API.
 * 
 * FEATURES:
 * - Configurable length (8-128 chars)
 * - Character set options (uppercase, lowercase, numbers, symbols)
 * - Multiple password generation
 * - Entropy calculation
 * 
 * SECURITY:
 * - Uses crypto.getRandomValues() for secure randomness
 * - No passwords are sent to any server
 * - All generation happens in browser memory
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import { copyToClipboard } from '../../lib/utils'

// Character sets for password generation
const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
}

/**
 * Generates a cryptographically secure password
 */
function generatePassword(length: number, charsets: string[]): string {
  const chars = charsets.join('')
  if (chars.length === 0) return ''

  const array = new Uint32Array(length)
  crypto.getRandomValues(array)

  return Array.from(array)
    .map((n) => chars[n % chars.length])
    .join('')
}

/**
 * Calculates password entropy in bits
 */
function calculateEntropy(length: number, charsetSize: number): number {
  return Math.floor(length * Math.log2(charsetSize))
}

export default function PasswordTool() {
  const [length, setLength] = useState(16)
  const [count, setCount] = useState(5)
  const [options, setOptions] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  })
  const [passwords, setPasswords] = useState<string[]>([])

  // Build charset from options
  const charset = Object.entries(options)
    .filter(([, enabled]) => enabled)
    .map(([key]) => CHAR_SETS[key as keyof typeof CHAR_SETS])

  const charsetSize = charset.join('').length
  const entropy = calculateEntropy(length, charsetSize)

  function handleGenerate() {
    const newPasswords = Array.from({ length: count }, () =>
      generatePassword(length, charset)
    )
    setPasswords(newPasswords)
  }

  function toggleOption(key: keyof typeof options) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Entropy strength indicator
  function getStrengthLabel(bits: number): { label: string; color: string } {
    if (bits >= 128) return { label: 'Excellent', color: 'text-green-400' }
    if (bits >= 80) return { label: 'Strong', color: 'text-blue-400' }
    if (bits >= 60) return { label: 'Good', color: 'text-yellow-400' }
    if (bits >= 40) return { label: 'Moderate', color: 'text-orange-400' }
    return { label: 'Weak', color: 'text-red-400' }
  }

  const strength = getStrengthLabel(entropy)

  const output = passwords.length > 0
    ? passwords.join('\n')
    : 'Click "Generate" to create passwords'

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            Secure generation using Web Crypto API. Passwords never leave your browser.
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          {/* Length slider */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Length: {length} characters
            </label>
            <input
              type="range"
              min={8}
              max={128}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>8</span>
              <span>128</span>
            </div>
          </div>

          {/* Count */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Number of passwords: {count}
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Character options */}
          <div>
            <label className="block text-sm font-medium mb-2">Characters</label>
            <div className="space-y-2">
              {Object.entries(CHAR_SETS).map(([key, chars]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options[key as keyof typeof options]}
                    onChange={() => toggleOption(key as keyof typeof options)}
                    className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-800"
                  />
                  <span className="capitalize">{key}</span>
                  <code className="text-xs text-gray-500 ml-auto">
                    {chars.slice(0, 10)}...
                  </code>
                </label>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={charsetSize === 0}
            className="btn-primary w-full"
          >
            Generate Passwords
          </button>

          {/* Strength indicator */}
          <div className="card p-4">
            <h4 className="font-medium mb-2">Password Strength</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Entropy:</span>
                <span>{entropy} bits</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Charset size:</span>
                <span>{charsetSize} characters</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Strength:</span>
                <span className={strength.color}>{strength.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Output section */}
        <div className="space-y-4">
          {passwords.length > 0 && (
            <div className="flex items-center justify-end">
              <AddToReportButton
                toolId="password"
                input={`${count} passwords, ${length} chars`}
                data={{ passwords, entropy, strength: strength.label }}
                category="Utilities"
              />
            </div>
          )}
          <OutputCard title="Generated Passwords" value={output} />
          
          {/* Quick copy buttons */}
          {passwords.length > 0 && (
            <div className="space-y-2">
              {passwords.map((pwd, i) => (
                <button
                  key={i}
                  onClick={() => copyToClipboard(pwd)}
                  className="w-full text-left px-3 py-2 font-mono text-sm bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                >
                  {pwd}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

