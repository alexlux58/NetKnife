import { useState, useEffect } from 'react'
import { guidesListProgress, type GuideProgressItem } from '../../lib/guides'
import { GUIDE_REGISTRY } from '../../guides/registry'

interface CoverageMetric {
  techniqueId: string
  techniqueName: string
  category: string
  hasDetection: boolean
  hasPrevention: boolean
  hasResponse: boolean
  maturity: 'none' | 'basic' | 'intermediate' | 'advanced'
  notes: string
}

export default function CoverageMapPage() {
  const [progress, setProgress] = useState<GuideProgressItem[]>([])
  const [coverage, setCoverage] = useState<CoverageMetric[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const res = await guidesListProgress()
      setProgress(res.items || [])
      
      // Extract ATT&CK techniques from guide progress
      const techniques = new Map<string, CoverageMetric>()
      
      // Collect all ATT&CK techniques from guides
      Object.values(GUIDE_REGISTRY).forEach((guide) => {
        guide.steps.forEach((step) => {
          step.attckTechniques.forEach((techId) => {
            if (!techniques.has(techId)) {
              techniques.set(techId, {
                techniqueId: techId,
                techniqueName: techId, // Could fetch from ATT&CK API
                category: step.title,
                hasDetection: false,
                hasPrevention: false,
                hasResponse: false,
                maturity: 'none',
                notes: '',
              })
            }
          })
        })
      })

      // Check progress for coverage indicators
      progress.forEach((p) => {
        const guide = GUIDE_REGISTRY[p.guideId]
        if (!guide) return
        
        const step = guide.steps.find((s) => s.id === p.stepId)
        if (!step) return

        step.attckTechniques.forEach((techId) => {
          const metric = techniques.get(techId)
          if (metric && p.completed) {
            metric.hasDetection = true
            if (p.findings && p.findings.length > 0) {
              metric.hasResponse = true
            }
            if (p.toolResults && Object.keys(p.toolResults).length > 0) {
              metric.hasPrevention = true
            }
            // Determine maturity based on completion and findings
            if (p.findings && p.findings.length > 0 && p.toolResults && Object.keys(p.toolResults).length > 0) {
              metric.maturity = 'advanced'
            } else if (p.completed) {
              metric.maturity = 'basic'
            }
          }
        })
      })

      setCoverage(Array.from(techniques.values()))
    } catch (err) {
      console.error('Failed to load coverage data:', err)
    } finally {
      setLoading(false)
    }
  }

  const coveragePct = coverage.length > 0
    ? Math.round((coverage.filter((c) => c.hasDetection || c.hasPrevention || c.hasResponse).length / coverage.length) * 100)
    : 0

  const maturityCounts = {
    none: coverage.filter((c) => c.maturity === 'none').length,
    basic: coverage.filter((c) => c.maturity === 'basic').length,
    intermediate: coverage.filter((c) => c.maturity === 'intermediate').length,
    advanced: coverage.filter((c) => c.maturity === 'advanced').length,
  }

  if (loading) {
    return (
      <div className="card p-6 text-center">
        <div className="text-gray-400">Loading coverage map...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coverage Map</h1>
        <p className="text-gray-400 mt-1">
          Map your detection, prevention, and response capabilities to MITRE ATT&CK techniques.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Overall Coverage</div>
          <div className="text-2xl font-bold">{coveragePct}%</div>
          <div className="text-xs text-gray-500 mt-1">{coverage.length} techniques tracked</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Advanced</div>
          <div className="text-2xl font-bold text-green-400">{maturityCounts.advanced}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Intermediate</div>
          <div className="text-2xl font-bold text-blue-400">{maturityCounts.intermediate}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Basic</div>
          <div className="text-2xl font-bold text-yellow-400">{maturityCounts.basic}</div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-medium mb-4">ATT&CK Technique Coverage</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363d] text-left">
                <th className="px-3 py-2">Technique</th>
                <th className="px-3 py-2">Detection</th>
                <th className="px-3 py-2">Prevention</th>
                <th className="px-3 py-2">Response</th>
                <th className="px-3 py-2">Maturity</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((c) => (
                <tr key={c.techniqueId} className="border-b border-[#21262d]">
                  <td className="px-3 py-2">
                    <a
                      href={`https://attack.mitre.org/techniques/${c.techniqueId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline font-mono"
                    >
                      {c.techniqueId}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    {c.hasDetection ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.hasPrevention ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.hasResponse ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        c.maturity === 'advanced'
                          ? 'bg-green-500/20 text-green-400'
                          : c.maturity === 'intermediate'
                          ? 'bg-blue-500/20 text-blue-400'
                          : c.maturity === 'basic'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-500/20 text-gray-500'
                      }`}
                    >
                      {c.maturity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
