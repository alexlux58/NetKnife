/**
 * ==============================================================================
 * NETKNIFE - TIMESTAMP CONVERTER TOOL
 * ==============================================================================
 * 
 * Convert between Unix timestamps and human-readable dates.
 * Essential for parsing logs and debugging time-related issues.
 * 
 * FEATURES:
 * - Unix timestamp ↔ Human date conversion
 * - Multiple formats (ISO 8601, RFC 2822, etc.)
 * - Timezone support
 * - Relative time display
 * - Current time display
 * 
 * All conversions happen client-side - no data leaves the browser.
 * ==============================================================================
 */

import { useState, useEffect, useMemo } from 'react'

interface TimeResult {
  unix: number
  unixMs: number
  iso8601: string
  rfc2822: string
  utc: string
  local: string
  relative: string
  date: Date
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
function formatRelative(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const absSec = Math.abs(diffSec)

  const future = diffSec > 0
  const prefix = future ? 'in ' : ''
  const suffix = future ? '' : ' ago'

  if (absSec < 60) return `${prefix}${absSec} seconds${suffix}`
  if (absSec < 3600) return `${prefix}${Math.floor(absSec / 60)} minutes${suffix}`
  if (absSec < 86400) return `${prefix}${Math.floor(absSec / 3600)} hours${suffix}`
  if (absSec < 2592000) return `${prefix}${Math.floor(absSec / 86400)} days${suffix}`
  if (absSec < 31536000) return `${prefix}${Math.floor(absSec / 2592000)} months${suffix}`
  return `${prefix}${Math.floor(absSec / 31536000)} years${suffix}`
}

/**
 * Parse various timestamp formats
 */
function parseInput(input: string): Date | null {
  const trimmed = input.trim()

  // Unix timestamp (seconds)
  if (/^\d{10}$/.test(trimmed)) {
    return new Date(parseInt(trimmed) * 1000)
  }

  // Unix timestamp (milliseconds)
  if (/^\d{13}$/.test(trimmed)) {
    return new Date(parseInt(trimmed))
  }

  // Try parsing as date string
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    return parsed
  }

  return null
}

export default function TimestampTool() {
  const [input, setInput] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const result: TimeResult | null = useMemo(() => {
    const date = parseInput(input)
    if (!date) return null

    return {
      unix: Math.floor(date.getTime() / 1000),
      unixMs: date.getTime(),
      iso8601: date.toISOString(),
      rfc2822: date.toUTCString(),
      utc: date.toUTCString(),
      local: date.toLocaleString(),
      relative: formatRelative(date),
      date,
    }
  }, [input])

  function setToNow() {
    setInput(Math.floor(Date.now() / 1000).toString())
  }

  function setToSpecific(offset: number) {
    const target = new Date(Date.now() + offset * 1000)
    setInput(Math.floor(target.getTime() / 1000).toString())
  }

  function handleCopy(value: string) {
    navigator.clipboard.writeText(value)
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            All conversions run locally. No data is sent to any server.
          </span>
        </div>
      </div>

      {/* Current time display */}
      <div className="card p-4 bg-blue-950/20 border-blue-900/50">
        <h4 className="text-sm font-medium text-blue-400 mb-2">Current Time</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Unix:</span>
            <code className="ml-2 text-gray-300">
              {Math.floor(currentTime.getTime() / 1000)}
            </code>
          </div>
          <div>
            <span className="text-gray-500">Local:</span>
            <code className="ml-2 text-gray-300">
              {currentTime.toLocaleString()}
            </code>
          </div>
        </div>
      </div>

      {/* Input */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Enter Timestamp or Date
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="1703001600 or 2023-12-19T12:00:00Z"
          className="input font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">
          Accepts: Unix seconds, Unix milliseconds, ISO 8601, or date strings
        </p>
      </div>

      {/* Quick buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={setToNow} className="btn-secondary text-sm">
          Now
        </button>
        <button onClick={() => setToSpecific(3600)} className="btn-secondary text-sm">
          +1 hour
        </button>
        <button onClick={() => setToSpecific(86400)} className="btn-secondary text-sm">
          +1 day
        </button>
        <button onClick={() => setToSpecific(604800)} className="btn-secondary text-sm">
          +1 week
        </button>
        <button onClick={() => setToSpecific(-3600)} className="btn-secondary text-sm">
          -1 hour
        </button>
        <button onClick={() => setToSpecific(-86400)} className="btn-secondary text-sm">
          -1 day
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="card p-4">
            <h4 className="text-sm font-medium text-purple-400 mb-3">Converted Values</h4>
            <div className="space-y-3">
              {[
                { label: 'Unix (seconds)', value: result.unix.toString() },
                { label: 'Unix (milliseconds)', value: result.unixMs.toString() },
                { label: 'ISO 8601', value: result.iso8601 },
                { label: 'RFC 2822', value: result.rfc2822 },
                { label: 'Local', value: result.local },
                { label: 'Relative', value: result.relative },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-500 text-sm">{label}:</span>
                    <code className="ml-2 text-gray-300 text-sm">{value}</code>
                  </div>
                  <button
                    onClick={() => handleCopy(value)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Date breakdown */}
          <div className="card p-4">
            <h4 className="text-sm font-medium text-amber-400 mb-3">Date Breakdown</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Year:</span>
                <span className="ml-2 text-gray-300">{result.date.getFullYear()}</span>
              </div>
              <div>
                <span className="text-gray-500">Month:</span>
                <span className="ml-2 text-gray-300">{result.date.getMonth() + 1}</span>
              </div>
              <div>
                <span className="text-gray-500">Day:</span>
                <span className="ml-2 text-gray-300">{result.date.getDate()}</span>
              </div>
              <div>
                <span className="text-gray-500">Weekday:</span>
                <span className="ml-2 text-gray-300">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][result.date.getDay()]}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Hour:</span>
                <span className="ml-2 text-gray-300">{result.date.getHours()}</span>
              </div>
              <div>
                <span className="text-gray-500">Minute:</span>
                <span className="ml-2 text-gray-300">{result.date.getMinutes()}</span>
              </div>
              <div>
                <span className="text-gray-500">Second:</span>
                <span className="ml-2 text-gray-300">{result.date.getSeconds()}</span>
              </div>
              <div>
                <span className="text-gray-500">TZ Offset:</span>
                <span className="ml-2 text-gray-300">
                  UTC{result.date.getTimezoneOffset() <= 0 ? '+' : '-'}
                  {Math.abs(result.date.getTimezoneOffset() / 60)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invalid input */}
      {input && !result && (
        <div className="card bg-red-950/20 border-red-900/50 p-4">
          <p className="text-red-400 text-sm">
            Could not parse input. Try a Unix timestamp or ISO 8601 format.
          </p>
        </div>
      )}

      {/* Reference */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">Common Timestamps</h4>
        <div className="grid grid-cols-2 gap-2 text-gray-400 text-xs font-mono">
          <div>0 → 1970-01-01 (Unix epoch)</div>
          <div>2147483647 → 2038-01-19 (Y2K38)</div>
          <div>1000000000 → 2001-09-09</div>
          <div>1700000000 → 2023-11-14</div>
        </div>
      </div>
    </div>
  )
}

