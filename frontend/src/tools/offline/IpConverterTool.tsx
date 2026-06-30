/**
 * ==============================================================================
 * NETKNIFE - IP ADDRESS CONVERTER TOOL
 * ==============================================================================
 * 
 * Convert between different IP address representations.
 * 
 * FEATURES:
 * - Decimal (dotted) ↔ Integer ↔ Hex ↔ Binary
 * - IPv4 and IPv6 support
 * - Real-time conversion as you type
 * - Bit-level visualization
 * ==============================================================================
 */

import { useState, useEffect } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import {
  convertIpInput,
  type Ipv4Representations,
  type Ipv6Representations,
} from './ipConverterLogic'

export default function IpConverterTool() {
  const [input, setInput] = useState('192.168.1.1')
  const [ipv4Result, setIpv4Result] = useState<Ipv4Representations | null>(null)
  const [ipv6Result, setIpv6Result] = useState<Ipv6Representations | null>(null)
  const [inputType, setInputType] = useState<'ipv4' | 'ipv6'>('ipv4')

  useEffect(() => {
    const converted = convertIpInput(input)
    setIpv4Result(converted.ipv4)
    setIpv6Result(converted.ipv6)
    if (converted.type) {
      setInputType(converted.type)
    }
  }, [input])

  const renderBinaryVisualization = (binary: string) => {
    return (
      <div className="font-mono text-xs">
        <div className="flex flex-wrap gap-1">
          {binary.split('.').map((octet, i) => (
            <div key={i} className="flex">
              {octet.split('').map((bit, j) => (
                <span
                  key={j}
                  className={`w-3 h-5 flex items-center justify-center ${
                    bit === '1' ? 'bg-blue-500 text-white' : 'bg-[#21262d] text-gray-500'
                  }`}
                >
                  {bit}
                </span>
              ))}
              {i < 3 && <span className="mx-1 text-gray-500">.</span>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">IP Address Converter</h1>
        <p className="text-gray-400 mt-1">
          Convert between decimal, hex, binary, and other IP representations
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Input</h2>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter IPv4 or IPv6 address"
            className="input font-mono text-lg"
          />
          <p className="text-xs text-gray-500 mt-2">
            Accepts: dotted decimal, integer, hex (0x prefix), binary, dotted binary
          </p>
          
          {/* Quick examples */}
          <div className="mt-4">
            <div className="text-sm text-gray-400 mb-2">Examples:</div>
            <div className="flex flex-wrap gap-2">
              {['192.168.1.1', '10.0.0.1', '3232235777', '0xC0A80101', '::1', '2001:db8::1'].map(ex => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="text-xs px-2 py-1 rounded bg-[#21262d] text-gray-400 hover:text-white transition-colors font-mono"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Detection</h2>
          {ipv4Result || ipv6Result ? (
            <div className="text-lg">
              <span className={`px-3 py-1 rounded font-medium ${
                inputType === 'ipv4' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-purple-500/20 text-purple-400'
              }`}>
                {inputType.toUpperCase()}
              </span>
              <span className="text-gray-400 ml-3">Valid address detected</span>
            </div>
          ) : (
            <div className="text-yellow-400">
              Enter a valid IPv4 or IPv6 address
            </div>
          )}
        </div>
      </div>

      {/* IPv4 Results */}
      {ipv4Result && (
        <div className="space-y-4">
          {/* Add to Report Button */}
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="ip-converter"
              input={input}
              data={ipv4Result}
              category="Network Intelligence"
            />
          </div>
          <h2 className="text-lg font-semibold">IPv4 Representations</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <OutputCard title="Dotted Decimal" canCopy>
              <div className="font-mono text-xl text-blue-400">{ipv4Result.dotted}</div>
            </OutputCard>
            
            <OutputCard title="Decimal (Integer)" canCopy>
              <div className="font-mono text-xl text-green-400">{ipv4Result.decimal}</div>
            </OutputCard>
            
            <OutputCard title="Hexadecimal" canCopy>
              <div className="font-mono text-xl text-purple-400">{ipv4Result.hex}</div>
            </OutputCard>
            
            <OutputCard title="Dotted Hex" canCopy>
              <div className="font-mono text-lg text-purple-400">{ipv4Result.hexDotted}</div>
            </OutputCard>
            
            <OutputCard title="Octal" canCopy>
              <div className="font-mono text-xl text-orange-400">{ipv4Result.octal}</div>
            </OutputCard>
            
            <OutputCard title="Binary" canCopy>
              <div className="font-mono text-xs text-cyan-400 break-all">{ipv4Result.binary}</div>
            </OutputCard>
          </div>

          {/* Binary Visualization */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Binary Visualization</h3>
            {renderBinaryVisualization(ipv4Result.binaryDotted)}
            <div className="flex justify-between mt-2 text-xs text-gray-500 font-mono">
              <span>Octet 1</span>
              <span>Octet 2</span>
              <span>Octet 3</span>
              <span>Octet 4</span>
            </div>
          </div>
        </div>
      )}

      {/* IPv6 Results */}
      {ipv6Result && (
        <div className="space-y-4">
          {/* Add to Report Button */}
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="ip-converter"
              input={input}
              data={ipv6Result}
              category="Network Intelligence"
            />
          </div>
          <h2 className="text-lg font-semibold">IPv6 Representations</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <OutputCard title="Full Form" canCopy>
              <div className="font-mono text-sm text-blue-400 break-all">{ipv6Result.full}</div>
            </OutputCard>
            
            <OutputCard title="Compressed" canCopy>
              <div className="font-mono text-xl text-green-400">{ipv6Result.compressed}</div>
            </OutputCard>
            
            <OutputCard title="Hexadecimal" canCopy>
              <div className="font-mono text-xs text-purple-400 break-all">{ipv6Result.hex}</div>
            </OutputCard>
            
            <OutputCard title="Binary (128 bits)" canCopy>
              <div className="font-mono text-[10px] text-cyan-400 break-all leading-relaxed">
                {ipv6Result.binary.match(/.{16}/g)?.join('\n')}
              </div>
            </OutputCard>
          </div>
        </div>
      )}

      {/* Reference */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Reference</h3>
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div>
            <div className="text-blue-400 font-medium mb-2">IPv4 Formats</div>
            <ul className="space-y-1 text-gray-400 text-xs">
              <li>192.168.1.1 (dotted decimal)</li>
              <li>3232235777 (integer)</li>
              <li>0xC0A80101 (hex)</li>
              <li>0300.0250.0001.0001 (octal)</li>
            </ul>
          </div>
          <div>
            <div className="text-purple-400 font-medium mb-2">IPv6 Formats</div>
            <ul className="space-y-1 text-gray-400 text-xs">
              <li>2001:0db8:0000:0000:0000:0000:0000:0001</li>
              <li>2001:db8::1 (compressed)</li>
              <li>::1 (loopback)</li>
              <li>::ffff:192.168.1.1 (mapped IPv4)</li>
            </ul>
          </div>
          <div>
            <div className="text-green-400 font-medium mb-2">Conversion Notes</div>
            <ul className="space-y-1 text-gray-400 text-xs">
              <li>IPv4: 32 bits (4 bytes)</li>
              <li>IPv6: 128 bits (16 bytes)</li>
              <li>Each octet: 0-255 (8 bits)</li>
              <li>Max IPv4: 4,294,967,295</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

