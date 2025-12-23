/**
 * ==============================================================================
 * NETKNIFE - HASH GENERATOR TOOL
 * ==============================================================================
 * 
 * Generate cryptographic hashes from text or file input.
 * 
 * ALGORITHMS SUPPORTED:
 * - MD5 (legacy, not secure)
 * - SHA-1 (legacy, not secure)
 * - SHA-256 (recommended)
 * - SHA-384
 * - SHA-512
 * 
 * All hashing happens client-side using the Web Crypto API.
 * No data is sent to any server.
 * ==============================================================================
 */

import { useState, useCallback } from 'react'

type Algorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

interface HashResult {
  algorithm: string
  hash: string
  length: number
}

/**
 * Simple MD5 implementation (Web Crypto doesn't support MD5)
 * For legacy compatibility only - NOT cryptographically secure
 */
function md5(input: string): string {
  function rotateLeft(x: number, n: number): number {
    return (x << n) | (x >>> (32 - n))
  }

  function addUnsigned(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff)
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
    return (msw << 16) | (lsw & 0xffff)
  }

  function F(x: number, y: number, z: number): number { return (x & y) | (~x & z) }
  function G(x: number, y: number, z: number): number { return (x & z) | (y & ~z) }
  function H(x: number, y: number, z: number): number { return x ^ y ^ z }
  function I(x: number, y: number, z: number): number { return y ^ (x | ~z) }

  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }

  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }

  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }

  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }

  const encoder = new TextEncoder()
  const bytes = encoder.encode(input)
  const len = bytes.length

  const words: number[] = []
  for (let i = 0; i < len; i += 4) {
    words.push(
      (bytes[i] || 0) |
      ((bytes[i + 1] || 0) << 8) |
      ((bytes[i + 2] || 0) << 16) |
      ((bytes[i + 3] || 0) << 24)
    )
  }

  const bitLen = len * 8
  words[len >> 2] |= 0x80 << ((len % 4) * 8)
  words[(((len + 8) >> 6) << 4) + 14] = bitLen

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476

  for (let i = 0; i < words.length; i += 16) {
    const aa = a, bb = b, cc = c, dd = d
    const x = words.slice(i, i + 16)
    while (x.length < 16) x.push(0)

    a = FF(a, b, c, d, x[0], 7, 0xd76aa478); d = FF(d, a, b, c, x[1], 12, 0xe8c7b756)
    c = FF(c, d, a, b, x[2], 17, 0x242070db); b = FF(b, c, d, a, x[3], 22, 0xc1bdceee)
    a = FF(a, b, c, d, x[4], 7, 0xf57c0faf); d = FF(d, a, b, c, x[5], 12, 0x4787c62a)
    c = FF(c, d, a, b, x[6], 17, 0xa8304613); b = FF(b, c, d, a, x[7], 22, 0xfd469501)
    a = FF(a, b, c, d, x[8], 7, 0x698098d8); d = FF(d, a, b, c, x[9], 12, 0x8b44f7af)
    c = FF(c, d, a, b, x[10], 17, 0xffff5bb1); b = FF(b, c, d, a, x[11], 22, 0x895cd7be)
    a = FF(a, b, c, d, x[12], 7, 0x6b901122); d = FF(d, a, b, c, x[13], 12, 0xfd987193)
    c = FF(c, d, a, b, x[14], 17, 0xa679438e); b = FF(b, c, d, a, x[15], 22, 0x49b40821)

    a = GG(a, b, c, d, x[1], 5, 0xf61e2562); d = GG(d, a, b, c, x[6], 9, 0xc040b340)
    c = GG(c, d, a, b, x[11], 14, 0x265e5a51); b = GG(b, c, d, a, x[0], 20, 0xe9b6c7aa)
    a = GG(a, b, c, d, x[5], 5, 0xd62f105d); d = GG(d, a, b, c, x[10], 9, 0x02441453)
    c = GG(c, d, a, b, x[15], 14, 0xd8a1e681); b = GG(b, c, d, a, x[4], 20, 0xe7d3fbc8)
    a = GG(a, b, c, d, x[9], 5, 0x21e1cde6); d = GG(d, a, b, c, x[14], 9, 0xc33707d6)
    c = GG(c, d, a, b, x[3], 14, 0xf4d50d87); b = GG(b, c, d, a, x[8], 20, 0x455a14ed)
    a = GG(a, b, c, d, x[13], 5, 0xa9e3e905); d = GG(d, a, b, c, x[2], 9, 0xfcefa3f8)
    c = GG(c, d, a, b, x[7], 14, 0x676f02d9); b = GG(b, c, d, a, x[12], 20, 0x8d2a4c8a)

    a = HH(a, b, c, d, x[5], 4, 0xfffa3942); d = HH(d, a, b, c, x[8], 11, 0x8771f681)
    c = HH(c, d, a, b, x[11], 16, 0x6d9d6122); b = HH(b, c, d, a, x[14], 23, 0xfde5380c)
    a = HH(a, b, c, d, x[1], 4, 0xa4beea44); d = HH(d, a, b, c, x[4], 11, 0x4bdecfa9)
    c = HH(c, d, a, b, x[7], 16, 0xf6bb4b60); b = HH(b, c, d, a, x[10], 23, 0xbebfbc70)
    a = HH(a, b, c, d, x[13], 4, 0x289b7ec6); d = HH(d, a, b, c, x[0], 11, 0xeaa127fa)
    c = HH(c, d, a, b, x[3], 16, 0xd4ef3085); b = HH(b, c, d, a, x[6], 23, 0x04881d05)
    a = HH(a, b, c, d, x[9], 4, 0xd9d4d039); d = HH(d, a, b, c, x[12], 11, 0xe6db99e5)
    c = HH(c, d, a, b, x[15], 16, 0x1fa27cf8); b = HH(b, c, d, a, x[2], 23, 0xc4ac5665)

    a = II(a, b, c, d, x[0], 6, 0xf4292244); d = II(d, a, b, c, x[7], 10, 0x432aff97)
    c = II(c, d, a, b, x[14], 15, 0xab9423a7); b = II(b, c, d, a, x[5], 21, 0xfc93a039)
    a = II(a, b, c, d, x[12], 6, 0x655b59c3); d = II(d, a, b, c, x[3], 10, 0x8f0ccc92)
    c = II(c, d, a, b, x[10], 15, 0xffeff47d); b = II(b, c, d, a, x[1], 21, 0x85845dd1)
    a = II(a, b, c, d, x[8], 6, 0x6fa87e4f); d = II(d, a, b, c, x[15], 10, 0xfe2ce6e0)
    c = II(c, d, a, b, x[6], 15, 0xa3014314); b = II(b, c, d, a, x[13], 21, 0x4e0811a1)
    a = II(a, b, c, d, x[4], 6, 0xf7537e82); d = II(d, a, b, c, x[11], 10, 0xbd3af235)
    c = II(c, d, a, b, x[2], 15, 0x2ad7d2bb); b = II(b, c, d, a, x[9], 21, 0xeb86d391)

    a = addUnsigned(a, aa); b = addUnsigned(b, bb)
    c = addUnsigned(c, cc); d = addUnsigned(d, dd)
  }

  const hex = (n: number) => {
    let s = ''
    for (let i = 0; i < 4; i++) {
      s += ((n >> (i * 8 + 4)) & 0xf).toString(16) + ((n >> (i * 8)) & 0xf).toString(16)
    }
    return s
  }

  return hex(a) + hex(b) + hex(c) + hex(d)
}

/**
 * Hash using Web Crypto API
 */
async function hashWithWebCrypto(algorithm: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const buffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest(algorithm, buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function HashTool() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<HashResult[]>([])
  const [isHashing, setIsHashing] = useState(false)
  const [selectedAlgo, setSelectedAlgo] = useState<Algorithm | 'ALL'>('ALL')

  const algorithms: Algorithm[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

  const generateHashes = useCallback(async () => {
    if (!input) {
      setResults([])
      return
    }

    setIsHashing(true)
    const newResults: HashResult[] = []

    const algosToRun = selectedAlgo === 'ALL' ? algorithms : [selectedAlgo]

    for (const algo of algosToRun) {
      try {
        let hash: string
        if (algo === 'MD5') {
          hash = md5(input)
        } else {
          hash = await hashWithWebCrypto(algo, input)
        }
        newResults.push({
          algorithm: algo,
          hash,
          length: hash.length * 4, // bits
        })
      } catch (e) {
        newResults.push({
          algorithm: algo,
          hash: `Error: ${e instanceof Error ? e.message : 'Failed'}`,
          length: 0,
        })
      }
    }

    setResults(newResults)
    setIsHashing(false)
  }, [input, selectedAlgo])

  function handleCopy(hash: string) {
    navigator.clipboard.writeText(hash)
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            Hashes are computed locally using Web Crypto API. No data is sent to any server.
          </span>
        </div>
      </div>

      {/* Algorithm selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedAlgo('ALL')}
          className={`px-3 py-1.5 rounded text-sm transition-colors ${
            selectedAlgo === 'ALL'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {algorithms.map((algo) => (
          <button
            key={algo}
            onClick={() => setSelectedAlgo(algo)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              selectedAlgo === algo
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            } ${algo === 'MD5' || algo === 'SHA-1' ? 'text-amber-400' : ''}`}
          >
            {algo}
            {(algo === 'MD5' || algo === 'SHA-1') && (
              <span className="ml-1 text-xs">⚠️</span>
            )}
          </button>
        ))}
      </div>

      {/* Security warning for weak algorithms */}
      {(selectedAlgo === 'MD5' || selectedAlgo === 'SHA-1') && (
        <div className="card bg-amber-950/20 border-amber-900/50 p-3">
          <p className="text-amber-400 text-sm">
            ⚠️ {selectedAlgo} is cryptographically broken. Use SHA-256 or higher for security purposes.
          </p>
        </div>
      )}

      {/* Input */}
      <div>
        <label className="block text-sm font-medium mb-2">Input Text</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter text to hash..."
          className="input font-mono text-sm min-h-[120px]"
        />
      </div>

      {/* Generate button */}
      <button
        onClick={generateHashes}
        disabled={isHashing || !input}
        className="btn-primary"
      >
        {isHashing ? 'Hashing...' : 'Generate Hash'}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((result) => (
            <div key={result.algorithm} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`font-medium ${
                  result.algorithm === 'MD5' || result.algorithm === 'SHA-1'
                    ? 'text-amber-400'
                    : 'text-blue-400'
                }`}>
                  {result.algorithm}
                  <span className="text-gray-500 text-xs ml-2">
                    ({result.length} bits)
                  </span>
                </span>
                <button
                  onClick={() => handleCopy(result.hash)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Copy
                </button>
              </div>
              <code className="block text-sm text-gray-300 font-mono break-all bg-gray-900 p-2 rounded">
                {result.hash}
              </code>
            </div>
          ))}
        </div>
      )}

      {/* Reference */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">Hash Sizes</h4>
        <div className="grid grid-cols-2 gap-2 text-gray-400 text-xs">
          <div><span className="text-amber-400">MD5:</span> 128 bits (32 hex)</div>
          <div><span className="text-amber-400">SHA-1:</span> 160 bits (40 hex)</div>
          <div><span className="text-green-400">SHA-256:</span> 256 bits (64 hex)</div>
          <div><span className="text-green-400">SHA-384:</span> 384 bits (96 hex)</div>
          <div><span className="text-green-400">SHA-512:</span> 512 bits (128 hex)</div>
        </div>
      </div>
    </div>
  )
}

