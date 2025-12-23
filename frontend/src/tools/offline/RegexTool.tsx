/**
 * ==============================================================================
 * NETKNIFE - REGEX HELPER TOOL
 * ==============================================================================
 * 
 * Helps build and test regular expressions for grep/egrep usage.
 * 
 * FEATURES:
 * - Live pattern testing
 * - Match highlighting
 * - grep command generation
 * - ERE/PCRE mode hints
 * - Common pattern presets
 * 
 * All processing happens client-side.
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import OutputCard from '../../components/OutputCard'

// Common regex patterns for network/security logs
const PRESETS = [
  {
    name: 'IPv4 Address',
    pattern: '([0-9]{1,3}\\.){3}[0-9]{1,3}',
    example: 'src=192.168.1.10 dst=10.0.0.5',
  },
  {
    name: 'MAC Address',
    pattern: '([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}',
    example: 'arp 00:1a:2b:3c:4d:5e at eth0',
  },
  {
    name: 'Non-zero Numbers',
    pattern: '[1-9][0-9]*',
    example: 'dropped=0 accepted=5 blocked=12',
  },
  {
    name: 'Email Address',
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    example: 'user: admin@example.com logged in',
  },
  {
    name: 'Timestamp (syslog)',
    pattern: '[A-Z][a-z]{2}\\s+[0-9]+\\s[0-9:]+',
    example: 'Dec 25 12:34:56 server sshd[1234]: message',
  },
]

export default function RegexTool() {
  const [pattern, setPattern] = useState('([0-9]{1,3}\\.){3}[0-9]{1,3}')
  const [testText, setTestText] = useState('Connection from 192.168.1.100 to 10.0.0.1 port 22')
  const [mode, setMode] = useState<'ERE' | 'PCRE'>('ERE')

  // Test the regex and find matches
  const testResult = useMemo(() => {
    try {
      const regex = new RegExp(pattern, 'g')
      const matches = testText.match(regex) || []
      return {
        valid: true,
        matches,
        count: matches.length,
      }
    } catch (e) {
      return {
        valid: false,
        error: e instanceof Error ? e.message : 'Invalid regex',
        matches: [],
        count: 0,
      }
    }
  }, [pattern, testText])

  // Generate grep commands
  const commands = useMemo(() => {
    const escapedPattern = pattern.replace(/'/g, "'\\''")
    return {
      grepE: `grep -E '${escapedPattern}' file.log`,
      grepP: `grep -P '${escapedPattern}' file.log`,
      tailGrep: `tail -f /var/log/syslog | grep --line-buffered -E '${escapedPattern}'`,
      awk: `awk '/${escapedPattern}/' file.log`,
    }
  }, [pattern])

  // Output display
  const output = JSON.stringify(
    {
      pattern,
      mode,
      is_valid: testResult.valid,
      matches: testResult.matches,
      match_count: testResult.count,
      commands,
      ...(testResult.error ? { error: testResult.error } : {}),
    },
    null,
    2
  )

  function loadPreset(preset: typeof PRESETS[0]) {
    setPattern(preset.pattern)
    setTestText(preset.example)
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            Build grep patterns with live testing. Uses JavaScript regex (similar to PCRE).
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          {/* Mode selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Mode Hint</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('ERE')}
                className={mode === 'ERE' ? 'btn-primary' : 'btn-secondary'}
              >
                ERE (grep -E)
              </button>
              <button
                onClick={() => setMode('PCRE')}
                className={mode === 'PCRE' ? 'btn-primary' : 'btn-secondary'}
              >
                PCRE (grep -P)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              ERE is more portable; PCRE is more powerful but not always available.
            </p>
          </div>

          {/* Pattern input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Pattern
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className={`input font-mono ${!testResult.valid ? 'border-red-500' : ''}`}
            />
            {!testResult.valid && (
              <p className="text-xs text-red-400 mt-1">{testResult.error}</p>
            )}
          </div>

          {/* Test text */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Test Text
            </label>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={4}
              className="textarea font-mono"
            />
          </div>

          {/* Presets */}
          <div>
            <label className="block text-sm font-medium mb-2">Common Patterns</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => loadPreset(preset)}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Match summary */}
          <div className="card p-4">
            <h4 className="font-medium mb-2">Matches ({testResult.count})</h4>
            {testResult.matches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {testResult.matches.map((match, i) => (
                  <code
                    key={i}
                    className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-sm font-mono"
                  >
                    {match}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No matches</p>
            )}
          </div>
        </div>

        {/* Output section */}
        <OutputCard title="Result & Commands" value={output} />
      </div>
    </div>
  )
}

