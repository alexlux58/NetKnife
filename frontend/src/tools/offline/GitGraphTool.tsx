/**
 * ==============================================================================
 * NETKNIFE - GIT GRAPH VISUALIZER
 * ==============================================================================
 *
 * Visualize complex git branch and merge states from `git log --graph` output.
 *
 * FEATURES:
 * - Parse git log --graph --decorate --oneline output
 * - Colorized branch lanes
 * - Branch/merge summary extraction
 * - Copy/paste instructions for generating input
 *
 * All processing happens client-side.
 * ==============================================================================
 */

import { useMemo, useState } from 'react'
import AddToReportButton from '../../components/AddToReportButton'

const EXAMPLE_LOG = `*   9fceb2a (HEAD -> main, origin/main) Merge branch 'feature/ui'
|\  
| * 2c1f9d0 (feature/ui) Add new sidebar navigation
| * 6f8e3c1 Tweak tool cards
|/  
*   52b7a11 Merge branch 'feature/api'
|\  
| * 7d4a1ef (origin/feature/api, feature/api) Add headers endpoint
| * 21a9e08 Add auth guard
|/  
* 8bde3f3 Initial commit`

const LANE_COLORS = [
  'text-cyan-400',
  'text-emerald-400',
  'text-purple-400',
  'text-amber-400',
  'text-pink-400',
  'text-blue-400',
  'text-lime-400',
  'text-orange-400',
]

type GraphLine = {
  graph: string
  message: string
}

type GraphSummary = {
  commits: number
  merges: number
  branches: string[]
  remotes: string[]
  heads: string[]
}

function splitGraphLine(line: string): GraphLine {
  const match = line.match(/^(.*?)(\s{2,}.*)$/)
  if (match) {
    return { graph: match[1], message: match[2].trim() }
  }
  return { graph: line, message: '' }
}

function extractDecorations(message: string) {
  const decoMatch = message.match(/\(([^)]+)\)/)
  if (!decoMatch) return []
  return decoMatch[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function summarizeGraph(lines: GraphLine[]): GraphSummary {
  const branches = new Set<string>()
  const remotes = new Set<string>()
  const heads = new Set<string>()
  let commits = 0
  let merges = 0

  for (const line of lines) {
    if (line.graph.includes('*')) commits += 1
    if (line.message.toLowerCase().startsWith('merge')) merges += 1

    const decorations = extractDecorations(line.message)
    for (const deco of decorations) {
      if (deco.startsWith('HEAD -> ')) {
        const headName = deco.replace('HEAD -> ', '').trim()
        if (headName) heads.add(headName)
        continue
      }

      if (deco.startsWith('origin/') || deco.includes('/')) {
        remotes.add(deco)
      } else {
        branches.add(deco)
      }
    }
  }

  return {
    commits,
    merges,
    branches: Array.from(branches).sort(),
    remotes: Array.from(remotes).sort(),
    heads: Array.from(heads).sort(),
  }
}

function renderGraphChars(graph: string) {
  return graph.split('').map((char, index) => {
    if (char.trim() === '') {
      return (
        <span key={index} className="text-gray-700">
          {char}
        </span>
      )
    }
    const color = LANE_COLORS[index % LANE_COLORS.length]
    return (
      <span key={index} className={`font-semibold ${color}`}>
        {char}
      </span>
    )
  })
}

export default function GitGraphTool() {
  const [rawLog, setRawLog] = useState('')

  const parsed = useMemo(() => {
    const lines = rawLog
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .map(splitGraphLine)

    return {
      lines,
      summary: summarizeGraph(lines),
    }
  }, [rawLog])

  const reportData = useMemo(() => {
    return {
      summary: parsed.summary,
      commits: parsed.lines.map((line) => ({
        graph: line.graph,
        message: line.message,
      })),
    }
  }, [parsed])

  return (
    <div className="space-y-6">
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            Paste <code className="font-mono">git log --graph --decorate --oneline --all</code> output to visualize
            branch lanes and merges locally.
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Git log output</label>
            <textarea
              value={rawLog}
              onChange={(e) => setRawLog(e.target.value)}
              rows={12}
              className="textarea font-mono"
              placeholder="Run: git log --graph --decorate --oneline --all"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => setRawLog(EXAMPLE_LOG)}
                className="btn-secondary text-xs"
              >
                Load example
              </button>
              <button
                type="button"
                onClick={() => setRawLog('')}
                className="btn-secondary text-xs"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="card p-4 space-y-2">
            <h4 className="font-medium">How to generate input</h4>
            <ul className="text-sm text-gray-400 list-disc list-inside space-y-1">
              <li>
                Local repo: <code className="font-mono">git log --graph --decorate --oneline --all</code>
              </li>
              <li>
                Include remotes: <code className="font-mono">git fetch --all --prune</code> then run the log command.
              </li>
              <li>Copy/paste the output here to visualize lanes and merges.</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          {parsed.lines.length > 0 && (
            <div className="flex items-center justify-end">
              <AddToReportButton
                toolId="git-graph"
                input="git log --graph --decorate --oneline --all"
                data={reportData}
                category="Utilities"
              />
            </div>
          )}

          <div className="card p-4">
            <h4 className="font-medium mb-3">Graph Summary</h4>
            <div className="grid gap-2 text-sm text-gray-400">
              <div>Commits: <span className="text-gray-200">{parsed.summary.commits}</span></div>
              <div>Merges: <span className="text-gray-200">{parsed.summary.merges}</span></div>
              <div>
                Local branches: <span className="text-gray-200">{parsed.summary.branches.join(', ') || 'None detected'}</span>
              </div>
              <div>
                Remote refs: <span className="text-gray-200">{parsed.summary.remotes.join(', ') || 'None detected'}</span>
              </div>
              <div>
                HEAD refs: <span className="text-gray-200">{parsed.summary.heads.join(', ') || 'None detected'}</span>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h4 className="font-medium mb-3">Graph Visualization</h4>
            {parsed.lines.length === 0 ? (
              <p className="text-sm text-gray-500">Paste git log output to render the graph.</p>
            ) : (
              <div className="bg-black/40 rounded-md p-3 overflow-auto">
                <pre className="font-mono text-sm leading-6 text-gray-200">
                  {parsed.lines.map((line, index) => (
                    <div key={`${line.graph}-${index}`} className="whitespace-pre">
                      {renderGraphChars(line.graph)}{' '}
                      <span className="text-gray-200">{line.message}</span>
                    </div>
                  ))}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
