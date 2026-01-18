/**
 * ==============================================================================
 * NETKNIFE - ENCODER/DECODER TOOL
 * ==============================================================================
 * 
 * Encode and decode data in various formats.
 * 
 * FORMATS SUPPORTED:
 * - Base64 (standard and URL-safe)
 * - Hex (hexadecimal)
 * - URL encoding
 * - HTML entities
 * - Unicode escape sequences
 * 
 * All encoding/decoding happens client-side - no data leaves the browser.
 * ==============================================================================
 */

import { useState } from 'react'
import AddToReportButton from '../../components/AddToReportButton'

type Format = 'base64' | 'base64url' | 'hex' | 'url' | 'html' | 'unicode'

interface FormatInfo {
  name: string
  description: string
  encode: (input: string) => string
  decode: (input: string) => string
}

const FORMATS: Record<Format, FormatInfo> = {
  base64: {
    name: 'Base64',
    description: 'Standard Base64 encoding (RFC 4648)',
    encode: (input) => btoa(unescape(encodeURIComponent(input))),
    decode: (input) => decodeURIComponent(escape(atob(input))),
  },
  base64url: {
    name: 'Base64URL',
    description: 'URL-safe Base64 (used in JWTs)',
    encode: (input) => btoa(unescape(encodeURIComponent(input)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
    decode: (input) => {
      let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
      while (base64.length % 4) base64 += '='
      return decodeURIComponent(escape(atob(base64)))
    },
  },
  hex: {
    name: 'Hexadecimal',
    description: 'Hex encoding (each byte as 2 hex chars)',
    encode: (input) => {
      const encoder = new TextEncoder()
      const bytes = encoder.encode(input)
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    },
    decode: (input) => {
      const hex = input.replace(/\s/g, '')
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
      }
      return new TextDecoder().decode(bytes)
    },
  },
  url: {
    name: 'URL Encoding',
    description: 'Percent-encoding for URLs (RFC 3986)',
    encode: (input) => encodeURIComponent(input),
    decode: (input) => decodeURIComponent(input),
  },
  html: {
    name: 'HTML Entities',
    description: 'Encode special characters as HTML entities',
    encode: (input) => {
      const div = document.createElement('div')
      div.textContent = input
      return div.innerHTML
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    },
    decode: (input) => {
      const div = document.createElement('div')
      div.innerHTML = input
      return div.textContent || ''
    },
  },
  unicode: {
    name: 'Unicode Escape',
    description: 'JavaScript Unicode escape sequences (\\uXXXX)',
    encode: (input) => {
      return input
        .split('')
        .map((c) => {
          const code = c.charCodeAt(0)
          if (code > 127) {
            return '\\u' + code.toString(16).padStart(4, '0')
          }
          return c
        })
        .join('')
    },
    decode: (input) => {
      return input.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
    },
  },
}

export default function EncoderTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [format, setFormat] = useState<Format>('base64')
  const [error, setError] = useState('')

  function handleEncode() {
    setError('')
    try {
      const result = FORMATS[format].encode(input)
      setOutput(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Encoding failed')
      setOutput('')
    }
  }

  function handleDecode() {
    setError('')
    try {
      const result = FORMATS[format].decode(input)
      setOutput(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decoding failed')
      setOutput('')
    }
  }

  function handleSwap() {
    setInput(output)
    setOutput('')
    setError('')
  }

  function handleCopy() {
    navigator.clipboard.writeText(output)
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            All encoding/decoding runs locally. No data is sent to any server.
          </span>
        </div>
      </div>

      {/* Format selector */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FORMATS) as Format[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              format === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {FORMATS[f].name}
          </button>
        ))}
      </div>

      {/* Format description */}
      <p className="text-sm text-gray-500">{FORMATS[format].description}</p>

      {/* Input */}
      <div>
        <label className="block text-sm font-medium mb-2">Input</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter text to encode or decode..."
          className="input font-mono text-sm min-h-[120px]"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={handleEncode} className="btn-primary">
          Encode →
        </button>
        <button onClick={handleDecode} className="btn-primary">
          ← Decode
        </button>
        <button onClick={handleSwap} className="btn-secondary" disabled={!output}>
          ↕ Swap
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="card bg-red-950/20 border-red-900/50 p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Output */}
      {output && (
        <div className="space-y-4">
          {/* Add to Report Button */}
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="encoder"
              input={input}
              data={{ format, input, output }}
              category="Utilities"
            />
          </div>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Output</label>
          {output && (
            <button
              onClick={handleCopy}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Copy
            </button>
          )}
        </div>
        <textarea
          value={output}
          readOnly
          placeholder="Result will appear here..."
          className="input font-mono text-sm min-h-[120px] bg-gray-900"
        />
      </div>

      {/* Quick reference */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">Quick Examples</h4>
        <div className="grid gap-2 text-gray-400 text-xs font-mono">
          <div>
            <span className="text-gray-500">Base64:</span> SGVsbG8gV29ybGQ= → Hello World
          </div>
          <div>
            <span className="text-gray-500">Hex:</span> 48656c6c6f → Hello
          </div>
          <div>
            <span className="text-gray-500">URL:</span> Hello%20World → Hello World
          </div>
          <div>
            <span className="text-gray-500">HTML:</span> &amp;lt;div&amp;gt; → &lt;div&gt;
          </div>
        </div>
      </div>
    </div>
  )
}

