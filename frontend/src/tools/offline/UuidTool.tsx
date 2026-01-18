/**
 * ==============================================================================
 * NETKNIFE - UUID GENERATOR TOOL
 * ==============================================================================
 * 
 * Generate various types of UUIDs (Universally Unique Identifiers).
 * 
 * FEATURES:
 * - UUID v4 (random)
 * - UUID v1 (time-based) - simulated
 * - UUID v5 (namespace-based SHA-1)
 * - Bulk generation
 * - Various output formats
 * ==============================================================================
 */

import { useState } from 'react'
import { v1 as uuidv1, v4 as uuidv4, v5 as uuidv5 } from 'uuid'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

type UuidVersion = 'v1' | 'v4' | 'v5'
type OutputFormat = 'standard' | 'uppercase' | 'no-hyphens' | 'braces' | 'urn'

const NAMESPACE_OPTIONS = [
  { label: 'DNS', value: uuidv5.DNS, desc: 'For domain names' },
  { label: 'URL', value: uuidv5.URL, desc: 'For URLs' },
  { label: 'OID', value: '6ba7b812-9dad-11d1-80b4-00c04fd430c8', desc: 'For ISO OIDs' },
  { label: 'X500', value: '6ba7b814-9dad-11d1-80b4-00c04fd430c8', desc: 'For X.500 DNs' },
  { label: 'Custom', value: 'custom', desc: 'Your own namespace' },
]

function formatUuid(uuid: string, format: OutputFormat): string {
  switch (format) {
    case 'uppercase':
      return uuid.toUpperCase()
    case 'no-hyphens':
      return uuid.replace(/-/g, '')
    case 'braces':
      return `{${uuid}}`
    case 'urn':
      return `urn:uuid:${uuid}`
    default:
      return uuid
  }
}

function getVersionInfo(version: UuidVersion): { name: string; desc: string } {
  switch (version) {
    case 'v1':
      return { 
        name: 'Time-based (v1)', 
        desc: 'Based on timestamp and MAC address. Sortable by time.' 
      }
    case 'v4':
      return { 
        name: 'Random (v4)', 
        desc: 'Cryptographically random. Most common choice.' 
      }
    case 'v5':
      return { 
        name: 'Namespace (v5)', 
        desc: 'Deterministic based on namespace and name (SHA-1).' 
      }
  }
}

export default function UuidTool() {
  const [version, setVersion] = useState<UuidVersion>('v4')
  const [format, setFormat] = useState<OutputFormat>('standard')
  const [count, setCount] = useState(1)
  const [uuids, setUuids] = useState<string[]>([])
  
  // V5 specific
  const [namespace, setNamespace] = useState(uuidv5.DNS)
  const [customNamespace, setCustomNamespace] = useState('')
  const [name, setName] = useState('')

  const generateUuids = () => {
    const generated: string[] = []
    
    for (let i = 0; i < count; i++) {
      let uuid: string
      
      switch (version) {
        case 'v1':
          uuid = uuidv1()
          break
        case 'v5':
          const ns = namespace === 'custom' ? customNamespace : namespace
          if (!ns || !name) {
            uuid = 'Error: namespace and name required'
          } else {
            try {
              uuid = uuidv5(name, ns)
            } catch {
              uuid = 'Error: invalid namespace UUID'
            }
          }
          break
        case 'v4':
        default:
          uuid = uuidv4()
      }
      
      if (!uuid.startsWith('Error')) {
        uuid = formatUuid(uuid, format)
      }
      
      generated.push(uuid)
    }
    
    setUuids(generated)
  }

  const versionInfo = getVersionInfo(version)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">UUID Generator</h1>
        <p className="text-gray-400 mt-1">
          Generate universally unique identifiers (RFC 4122)
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="space-y-4">
          {/* Version Selection */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">UUID Version</h2>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['v1', 'v4', 'v5'] as UuidVersion[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVersion(v)}
                  className={`py-2 px-4 rounded font-medium transition-colors ${
                    version === v
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#21262d] text-gray-400 hover:text-white'
                  }`}
                >
                  UUID {v.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="text-sm">
              <div className="text-blue-400 font-medium">{versionInfo.name}</div>
              <div className="text-gray-400">{versionInfo.desc}</div>
            </div>
          </div>

          {/* V5 Options */}
          {version === 'v5' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold mb-4">Namespace & Name</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Namespace</label>
                  <select
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    className="input"
                  >
                    {NAMESPACE_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>
                        {opt.label} - {opt.desc}
                      </option>
                    ))}
                  </select>
                </div>
                
                {namespace === 'custom' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Custom Namespace UUID</label>
                    <input
                      type="text"
                      value={customNamespace}
                      onChange={(e) => setCustomNamespace(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="input font-mono"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="example.com"
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Same namespace + name always generates the same UUID
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Output Options */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Output Options</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as OutputFormat)}
                  className="input"
                >
                  <option value="standard">Standard (lowercase)</option>
                  <option value="uppercase">UPPERCASE</option>
                  <option value="no-hyphens">No hyphens</option>
                  <option value="braces">{'{Braces}'}</option>
                  <option value="urn">URN format</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Count</label>
                <div className="flex gap-2">
                  {[1, 5, 10, 25, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={`py-1 px-3 rounded text-sm transition-colors ${
                        count === n
                          ? 'bg-blue-500 text-white'
                          : 'bg-[#21262d] text-gray-400 hover:text-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateUuids}
            className="btn btn-primary w-full py-3 text-lg"
          >
            Generate {count} UUID{count > 1 ? 's' : ''}
          </button>
        </div>

        {/* Output */}
        <div className="space-y-4">
          {uuids.length > 0 && (
            <div className="flex items-center justify-end">
              <AddToReportButton
                toolId="uuid"
                input={`${version} - ${count} UUIDs`}
                data={uuids}
                category="Utilities"
              />
            </div>
          )}
          <OutputCard 
            title={`Generated UUIDs (${uuids.length})`} 
            canCopy
          >
            {uuids.length === 0 ? (
              <p className="text-gray-500">Click generate to create UUIDs</p>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {uuids.map((uuid, i) => (
                  <div
                    key={i}
                    className={`font-mono text-sm p-2 rounded ${
                      uuid.startsWith('Error')
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-[#161b22] text-blue-400'
                    }`}
                  >
                    {uuid}
                  </div>
                ))}
              </div>
            )}
          </OutputCard>

          {/* Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">UUID Structure</h3>
            <div className="font-mono text-sm mb-4">
              <span className="text-red-400">xxxxxxxx</span>-
              <span className="text-yellow-400">xxxx</span>-
              <span className="text-green-400">Vxxx</span>-
              <span className="text-blue-400">Nxxx</span>-
              <span className="text-purple-400">xxxxxxxxxxxx</span>
            </div>
            <div className="text-sm text-gray-400 space-y-1">
              <p><span className="text-red-400">Time-low</span> (32 bits)</p>
              <p><span className="text-yellow-400">Time-mid</span> (16 bits)</p>
              <p><span className="text-green-400">Version</span> + Time-high (16 bits)</p>
              <p><span className="text-blue-400">Variant</span> + Clock-seq (16 bits)</p>
              <p><span className="text-purple-400">Node</span> (48 bits)</p>
            </div>
          </div>

          {/* Statistics */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">UUID Facts</h3>
            <div className="text-sm text-gray-400 space-y-2">
              <p>• 128 bits = 16 bytes</p>
              <p>• 122 random bits in v4</p>
              <p>• ~5.3 × 10³⁶ possible v4 UUIDs</p>
              <p>• Collision probability at 1 billion/sec for 100 years: ~50%</p>
              <p>• Collision at 103 trillion v4 UUIDs: 1 in a billion</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

