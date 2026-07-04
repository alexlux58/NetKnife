/**
 * Mermaid diagram renderer — paste code, preview, export SVG/PNG.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import AddToReportButton from '../../components/AddToReportButton'
import { useToolState } from '../../lib/useToolState'
import { renderMermaidDiagram, svgToPngDataUrl } from './mermaidRender'
import { DEFAULT_MERMAID, MERMAID_TEMPLATES } from './mermaidTemplates'

export default function MermaidTool() {
  const [state, setState] = useToolState('mermaid', { source: DEFAULT_MERMAID })
  const { source } = state
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [rendering, setRendering] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const render = useCallback(async (code: string) => {
    setRendering(true)
    setError('')
    try {
      const out = await renderMermaidDiagram(code)
      setSvg(out)
    } catch (e) {
      setSvg('')
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRendering(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      render(source)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [source, render])

  const copySvg = async () => {
    if (!svg) return
    await navigator.clipboard.writeText(svg)
  }

  const downloadPng = async () => {
    if (!svg) return
    try {
      const dataUrl = await svgToPngDataUrl(svg)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'diagram.png'
      a.click()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PNG export failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm text-gray-400 flex flex-wrap gap-4 items-center justify-between">
        <p>Render Mermaid diagrams locally. Use for architecture, sequences, flowcharts, and git graphs.</p>
        <span className="badge-offline text-xs">LOCAL</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {MERMAID_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.description}
            onClick={() => setState({ source: t.code })}
            className="btn-secondary text-xs py-1 px-2"
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 min-h-[480px]">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-300">Mermaid source</label>
          <textarea
            value={source}
            onChange={(e) => setState({ source: e.target.value })}
            spellCheck={false}
            className="input font-mono text-sm flex-1 min-h-[400px] resize-y"
            placeholder="graph TD&#10;  A --> B"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-gray-300">Preview</label>
            <div className="flex gap-2">
              <button type="button" onClick={copySvg} disabled={!svg} className="btn-secondary text-xs py-1 px-2">
                Copy SVG
              </button>
              <button type="button" onClick={downloadPng} disabled={!svg} className="btn-secondary text-xs py-1 px-2">
                Download PNG
              </button>
              {svg && (
                <AddToReportButton
                  toolId="mermaid"
                  input={source.slice(0, 200)}
                  data={{ source, svgLength: svg.length }}
                  category="Data & Text"
                />
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#30363d] bg-[#0d1117] flex-1 min-h-[400px] overflow-auto p-4 relative">
            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/80 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400" />
              </div>
            )}
            {error ? (
              <pre className="text-red-400 text-sm whitespace-pre-wrap font-mono">{error}</pre>
            ) : svg ? (
              <div
                className="mermaid-preview [&_svg]:max-w-full [&_svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <p className="text-gray-500 text-sm">Diagram preview will appear here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
