/**
 * ==============================================================================
 * NETKNIFE - IPv6 ADDRESS ANALYZER TOOL
 * ==============================================================================
 * 
 * Comprehensive IPv6 address analysis and validation.
 * 
 * FEATURES:
 * - Address type detection (global unicast, link-local, unique local, etc.)
 * - Scope identification
 * - Compressed/expanded form conversion
 * - Reverse DNS format (PTR record format)
 * - Embedded IPv4 detection (IPv4-mapped/embedded)
 * - Address validation
 * 
 * All analysis happens client-side - no data leaves the browser.
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import { analyzeIpv6 } from './ipv6AnalyzerLogic'

export default function Ipv6AnalyzerTool() {
  const [input, setInput] = useState('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
  const [output, setOutput] = useState('')

  const analysis = useMemo(() => analyzeIpv6(input), [input])
  function handleAnalyze() {
    setOutput(JSON.stringify(analysis, null, 2))
  }

  function loadExample(type: 'global' | 'linklocal' | 'multicast' | 'ula' | 'mapped') {
    const examples = {
      global: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      linklocal: 'fe80::1',
      multicast: 'ff02::1',
      ula: 'fd00::1',
      mapped: '::ffff:192.168.1.1'
    }
    setInput(examples[type])
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-blue-950/30 border-blue-900/50 p-4 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-blue-400">ℹ️</span>
          <div>
            <div className="font-medium text-blue-300 mb-1">IPv6 Address Analyzer</div>
            <div className="text-blue-400/80">
              Analyzes IPv6 addresses to determine type, scope, and format. All processing happens locally in your browser.
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">IPv6 Address</label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="2001:0db8::1"
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports compressed (::) and expanded forms
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAnalyze}
              disabled={!analysis || 'error' in analysis}
              className="btn-primary"
            >
              Analyze Address
            </button>
          </div>

          {/* Examples */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Examples</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => loadExample('global')}
                className="btn-secondary text-xs py-1 px-2"
              >
                Global Unicast
              </button>
              <button
                onClick={() => loadExample('linklocal')}
                className="btn-secondary text-xs py-1 px-2"
              >
                Link-local
              </button>
              <button
                onClick={() => loadExample('multicast')}
                className="btn-secondary text-xs py-1 px-2"
              >
                Multicast
              </button>
              <button
                onClick={() => loadExample('ula')}
                className="btn-secondary text-xs py-1 px-2"
              >
                Unique Local
              </button>
              <button
                onClick={() => loadExample('mapped')}
                className="btn-secondary text-xs py-1 px-2"
              >
                IPv4-mapped
              </button>
            </div>
          </div>

          {/* Error display */}
          {'error' in analysis && (
            <div className="card bg-red-950/30 border-red-900/50 p-4 text-sm text-red-400">
              {analysis.error}
            </div>
          )}

          {/* Results preview */}
          {!('error' in analysis) && analysis.valid && (
            <div className="card p-4 space-y-3">
              <h4 className="font-medium text-sm">Quick Info</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Type:</span>
                  <span className="ml-2 text-cyan-400">{analysis.address_type}</span>
                </div>
                <div>
                  <span className="text-gray-500">Scope:</span>
                  <span className="ml-2 text-green-400">{analysis.scope}</span>
                </div>
                <div>
                  <span className="text-gray-500">Compressed:</span>
                  <span className="ml-2 font-mono text-xs">{analysis.compressed}</span>
                </div>
                {analysis.embedded_ipv4 && (
                  <div>
                    <span className="text-gray-500">Embedded IPv4:</span>
                    <span className="ml-2 font-mono text-xs">{analysis.embedded_ipv4}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Output section */}
        {output && analysis && !('error' in analysis) && (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <AddToReportButton
                toolId="ipv6-analyzer"
                input={input}
                data={analysis}
                category="Network Intelligence"
              />
            </div>
          </div>
        )}
        <OutputCard title="Analysis Result" value={output} />
      </div>
    </div>
  )
}

