/**
 * ==============================================================================
 * NETKNIFE - YAML ↔ JSON CONVERTER TOOL
 * ==============================================================================
 * 
 * Convert between YAML and JSON formats.
 * 
 * FEATURES:
 * - Bidirectional conversion
 * - Syntax validation
 * - Pretty formatting options
 * - Error highlighting
 * ==============================================================================
 */

import { useState } from 'react'
import yaml from 'js-yaml'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

type ConversionDirection = 'yaml-to-json' | 'json-to-yaml'

export default function YamlJsonTool() {
  const [direction, setDirection] = useState<ConversionDirection>('yaml-to-json')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [indentSize, setIndentSize] = useState(2)

  const convert = () => {
    setError('')
    setOutput('')
    
    if (!input.trim()) {
      setError('Please enter some input')
      return
    }
    
    try {
      if (direction === 'yaml-to-json') {
        // YAML → JSON
        const parsed = yaml.load(input)
        const json = JSON.stringify(parsed, null, indentSize)
        setOutput(json)
      } else {
        // JSON → YAML
        const parsed = JSON.parse(input)
        const yamlStr = yaml.dump(parsed, {
          indent: indentSize,
          lineWidth: -1, // No line wrapping
          noRefs: true,
          sortKeys: false,
        })
        setOutput(yamlStr)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed')
    }
  }

  const swapDirection = () => {
    setDirection(d => d === 'yaml-to-json' ? 'json-to-yaml' : 'yaml-to-json')
    // Also swap input/output if there's valid output
    if (output && !error) {
      setInput(output)
      setOutput('')
    }
  }

  const loadExample = () => {
    if (direction === 'yaml-to-json') {
      setInput(`# Example Kubernetes Pod
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
    environment: production
spec:
  containers:
    - name: nginx
      image: nginx:1.21
      ports:
        - containerPort: 80
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
      env:
        - name: NODE_ENV
          value: production
  restartPolicy: Always`)
    } else {
      setInput(`{
  "apiVersion": "v1",
  "kind": "Pod",
  "metadata": {
    "name": "nginx-pod",
    "labels": {
      "app": "nginx",
      "environment": "production"
    }
  },
  "spec": {
    "containers": [
      {
        "name": "nginx",
        "image": "nginx:1.21",
        "ports": [
          {
            "containerPort": 80
          }
        ],
        "resources": {
          "limits": {
            "memory": "128Mi",
            "cpu": "500m"
          }
        },
        "env": [
          {
            "name": "NODE_ENV",
            "value": "production"
          }
        ]
      }
    ],
    "restartPolicy": "Always"
  }
}`)
    }
    setOutput('')
    setError('')
  }

  const inputLabel = direction === 'yaml-to-json' ? 'YAML' : 'JSON'
  const outputLabel = direction === 'yaml-to-json' ? 'JSON' : 'YAML'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">YAML ↔ JSON Converter</h1>
        <p className="text-gray-400 mt-1">
          Convert between YAML and JSON formats
        </p>
      </div>

      {/* Controls */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Direction Toggle */}
          <div className="flex items-center gap-2 bg-[#161b22] rounded-lg p-1">
            <button
              onClick={() => setDirection('yaml-to-json')}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                direction === 'yaml-to-json'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              YAML → JSON
            </button>
            <button
              onClick={() => setDirection('json-to-yaml')}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                direction === 'json-to-yaml'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              JSON → YAML
            </button>
          </div>

          {/* Swap Button */}
          <button
            onClick={swapDirection}
            className="p-2 rounded hover:bg-[#21262d] text-gray-400 hover:text-white transition-colors"
            title="Swap direction and use output as input"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>

          {/* Indent Size */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Indent:</span>
            <select
              value={indentSize}
              onChange={(e) => setIndentSize(Number(e.target.value))}
              className="input py-1 px-2 w-16"
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
            </select>
          </div>

          {/* Example Button */}
          <button
            onClick={loadExample}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Load Example
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{inputLabel} Input</h2>
            <button
              onClick={() => { setInput(''); setOutput(''); setError('') }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Paste your ${inputLabel} here...`}
            className={`input font-mono text-sm min-h-[400px] ${
              error ? 'border-red-500' : ''
            }`}
            spellCheck={false}
          />
          <button
            onClick={convert}
            disabled={!input.trim()}
            className="btn btn-primary w-full mt-4"
          >
            Convert to {outputLabel}
          </button>
        </div>

        {/* Output */}
        <div className="space-y-4">
          {error && (
            <div className="card p-4 border-red-500 bg-red-500/10">
              <div className="text-red-400 font-medium mb-1">Conversion Error</div>
              <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono">{error}</pre>
            </div>
          )}
          
          {output && (
            <div className="flex items-center justify-end mb-2">
              <AddToReportButton
                toolId="yaml-json"
                input={input}
                data={{ direction, input, output }}
                category="Utilities"
              />
            </div>
          )}
          <OutputCard title={`${outputLabel} Output`} canCopy>
            {output ? (
              <pre className="font-mono text-sm whitespace-pre-wrap text-green-400 max-h-[400px] overflow-y-auto">
                {output}
              </pre>
            ) : (
              <p className="text-gray-500">
                Converted {outputLabel} will appear here
              </p>
            )}
          </OutputCard>

          {/* Tips */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Format Tips</h3>
            <div className="text-sm text-gray-400 space-y-3">
              <div>
                <div className="text-blue-400 font-medium mb-1">YAML Features:</div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Comments with # (not preserved in JSON)</li>
                  <li>Multi-line strings with | or &gt;</li>
                  <li>Anchors &amp; aliases for reuse</li>
                  <li>No quotes needed for most strings</li>
                </ul>
              </div>
              <div>
                <div className="text-green-400 font-medium mb-1">JSON Features:</div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Strict syntax (quotes required)</li>
                  <li>No trailing commas</li>
                  <li>No comments allowed</li>
                  <li>Universal parser support</li>
                </ul>
              </div>
              <div>
                <div className="text-yellow-400 font-medium mb-1">Common Uses:</div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Kubernetes manifests (YAML)</li>
                  <li>Docker Compose (YAML)</li>
                  <li>API responses (JSON)</li>
                  <li>Config files (both)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

