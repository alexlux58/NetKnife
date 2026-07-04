/**
 * Render Mermaid diagrams client-side (strict security, dark theme).
 */

let renderCounter = 0
let initPromise: Promise<typeof import('mermaid').default> | null = null

async function getMermaid() {
  if (!initPromise) {
    initPromise = import('mermaid').then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        themeVariables: {
          primaryColor: '#1f6feb',
          primaryTextColor: '#e6edf3',
          primaryBorderColor: '#30363d',
          lineColor: '#58a6ff',
          secondaryColor: '#161b22',
          tertiaryColor: '#0d1117',
        },
      })
      return mod.default
    })
  }
  return initPromise
}

export async function renderMermaidDiagram(source: string): Promise<string> {
  const code = source.trim()
  if (!code) throw new Error('Enter Mermaid diagram code')

  const mermaid = await getMermaid()
  const id = `nk-mermaid-${++renderCounter}-${Date.now()}`
  const { svg } = await mermaid.render(id, code)
  return svg
}

export async function svgToPngDataUrl(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width || 800
        canvas.height = img.height || 600
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas not supported')
        ctx.fillStyle = '#0d1117'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG for PNG export'))
    }
    img.src = url
  })
}
