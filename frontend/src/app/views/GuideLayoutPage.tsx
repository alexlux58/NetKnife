import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GUIDE_REGISTRY, type GuideStep } from '../../guides/registry'
import { useGuide } from '../../lib/GuideContext'
import AddToReportButton from '../../components/AddToReportButton'

function formatTimeSpent(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export default function GuideLayoutPage() {
  const { guideId, stepId } = useParams<{ guideId: string; stepId?: string }>()
  const navigate = useNavigate()
  const { setGuideAndStep, refreshGuideProgress, progressByStepId, saveStepProgress } = useGuide()
  const [notes, setNotes] = useState('')

  const resolvedGuide = guideId ? GUIDE_REGISTRY[guideId] : null
  const resolvedStep: GuideStep | null = useMemo(() => {
    if (!resolvedGuide) return null
    if (stepId) return resolvedGuide.steps.find((s) => s.id === stepId) || null
    return resolvedGuide.steps[0] || null
  }, [resolvedGuide, stepId])

  const progress = resolvedStep ? progressByStepId[resolvedStep.id] : undefined
  
  // Calculate time spent (if we have timestamps)
  const timeSpent = useMemo(() => {
    if (!progress?.lastViewedAt || !progress?.updatedAt) return null
    const diff = progress.updatedAt - (progress.lastViewedAt || progress.updatedAt)
    return diff > 0 ? diff : null
  }, [progress?.lastViewedAt, progress?.updatedAt])

  useEffect(() => {
    if (!resolvedGuide || !resolvedStep) return
    setGuideAndStep(resolvedGuide, resolvedStep)
    refreshGuideProgress(resolvedGuide.id).catch(() => {})
  }, [resolvedGuide?.id, resolvedStep?.id])

  useEffect(() => {
    setNotes(progress?.notes || '')
  }, [progress?.notes, resolvedStep?.id])

  if (!resolvedGuide) {
    return (
      <div className="card p-6">
        <div className="text-red-400 font-medium">Guide not found</div>
        <div className="mt-2">
          <Link to="/guides" className="text-blue-400 hover:underline">Back to Guides</Link>
        </div>
      </div>
    )
  }

  if (!resolvedStep) {
    return (
      <div className="card p-6">
        <div className="text-red-400 font-medium">Step not found</div>
        <div className="mt-2">
          <Link to={`/guides/${resolvedGuide.id}/${resolvedGuide.steps[0]?.id ?? ''}`} className="text-blue-400 hover:underline">
            Go to first step
          </Link>
        </div>
      </div>
    )
  }

  // From here onward, resolvedGuide/resolvedStep are non-null.
  const g = resolvedGuide
  const s = resolvedStep

  const stepIndex = g.steps.findIndex((st) => st.id === s.id)
  const prevStep = stepIndex > 0 ? g.steps[stepIndex - 1] : null
  const nextStep = stepIndex >= 0 && stepIndex < g.steps.length - 1 ? g.steps[stepIndex + 1] : null

  const completionPct = Math.round(
    (g.steps.filter((st) => progressByStepId[st.id]?.completed).length / g.steps.length) * 100
  )

  async function saveNotesOnly() {
    // resolvedGuide/resolvedStep are non-null here (guarded above)
    await saveStepProgress({
      guideId: g.id,
      stepId: s.id,
      completed: progress?.completed || false,
      notes,
      findings: progress?.findings || [],
      scanResults: progress?.scanResults || [],
      toolResults: progress?.toolResults || {},
    })
  }

  async function toggleComplete() {
    await saveStepProgress({
      guideId: g.id,
      stepId: s.id,
      completed: !progress?.completed,
      notes,
      findings: progress?.findings || [],
      scanResults: progress?.scanResults || [],
      toolResults: progress?.toolResults || {},
    })
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xl font-bold truncate">{g.name}</div>
            <div className="text-sm text-gray-400 mt-1">{g.description}</div>
            <div className="text-xs text-gray-500 mt-2">
              Frameworks: {g.frameworks.join(' • ')}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-gray-500">Progress</div>
            <div className="text-lg font-semibold">{completionPct}%</div>
            {timeSpent && (
              <div className="text-xs text-gray-500 mt-1">Time: {formatTimeSpent(timeSpent)}</div>
            )}
          </div>
        </div>
        <div className="mt-3 w-full bg-[#161b22] rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${completionPct}%` }} />
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">Step {stepIndex + 1} / {g.steps.length}</div>
            <h2 className="text-2xl font-bold">{s.title}</h2>
          </div>
          {progress?.completed ? (
            <span className="badge bg-emerald-500/20 text-emerald-400">✓ Completed</span>
          ) : (
            <span className="badge bg-gray-500/20 text-gray-400">In progress</span>
          )}
        </div>
        <p className="text-gray-300">{s.overview}</p>
        {(s.attckTechniques.length > 0 || s.d3fendMitigations.length > 0) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {s.attckTechniques.map((t) => (
              <a
                key={t}
                href={`https://attack.mitre.org/techniques/${t}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-300 font-mono hover:bg-purple-500/30"
                title={`MITRE ATT&CK Technique ${t}`}
              >
                ATT&CK: {t}
              </a>
            ))}
            {s.d3fendMitigations.map((m) => (
              <a
                key={m}
                href={`https://d3fend.mitre.org/technique/${m.toLowerCase()}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-300 font-mono hover:bg-blue-500/30"
                title={`MITRE D3FEND Mitigation ${m}`}
              >
                D3FEND: {m}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-medium mb-2">Objectives</h3>
            <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
              {s.objectives.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="font-medium mb-2">Tools</h3>
            <div className="space-y-3">
              {s.tools.map((t) => (
                <div key={t.toolId} className="p-3 rounded bg-[#161b22]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{t.toolId}</div>
                      <div className="text-xs text-gray-500 mt-1">{t.purpose}</div>
                      {t.tips?.length > 0 && (
                        <div className="text-xs text-gray-400 mt-2">{t.tips.join(' • ')}</div>
                      )}
                    </div>
                    <Link to={`/tools/${t.toolId}`} className="btn-secondary text-xs whitespace-nowrap">
                      Open tool
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-medium">Notes</h3>
              <button onClick={saveNotesOnly} className="btn-secondary text-xs">Save</button>
            </div>
            <textarea
              className="textarea w-full"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Capture evidence, hypotheses, observations, and next actions."
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <AddToReportButton
                toolId={`guide-${g.id}-${s.id}`}
                input={`${g.id}/${s.id}`}
                data={{ guide: g.id, step: s.id, notes, progress }}
                category={g.category === 'offensive' ? 'pentest' : 'report'}
              />
              <button onClick={toggleComplete} className={progress?.completed ? 'btn-secondary' : 'btn-primary'}>
                {progress?.completed ? 'Mark incomplete' : 'Mark complete'}
              </button>
            </div>
          </div>

          {s.defense.length > 0 && (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Defense Strategies</h3>
              <div className="space-y-3 text-sm">
                {s.defense.map((d, idx) => (
                  <div key={idx} className="p-2 rounded bg-[#161b22]">
                    <div className="flex items-start gap-2 mb-1">
                      <h4 className="font-medium text-gray-300">{d.name}</h4>
                      {d.d3fendMitigation && (
                        <a
                          href={d.d3fendUrl || `https://d3fend.mitre.org/technique/${d.d3fendMitigation.toLowerCase()}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline font-mono"
                        >
                          {d.d3fendMitigation}
                        </a>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mb-2">{d.description}</p>
                    {d.implementation.length > 0 && (
                      <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5">
                        {d.implementation.map((impl, i) => (
                          <li key={i}>{impl}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cross-references to related guides */}
          {g.category === 'offensive' && (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Related Blue Team Guides</h3>
              <div className="space-y-1 text-sm">
                <Link to="/guides/blue-team-nist" className="text-blue-400 hover:underline">
                  NIST Cybersecurity Framework
                </Link>
                <div className="text-xs text-gray-500 mt-1">
                  Learn defensive controls for this attack phase
                </div>
              </div>
            </div>
          )}

          {g.category === 'defensive' && (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Related Offensive Guides</h3>
              <div className="space-y-1 text-sm">
                <Link to="/guides/kill-chain" className="text-blue-400 hover:underline">
                  Cyber Kill Chain
                </Link>
                <div className="text-xs text-gray-500 mt-1">
                  Understand attacker tactics for this defense phase
                </div>
              </div>
            </div>
          )}

          <div className="card p-4">
            <h3 className="font-medium mb-2">Resources</h3>
            <div className="space-y-1 text-sm">
              {s.resources.map((r) => (
                <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">
                  {r.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => (prevStep ? navigate(`/guides/${g.id}/${prevStep.id}`) : navigate('/guides'))}
          className="btn-secondary"
        >
          ← {prevStep ? 'Previous' : 'Back'}
        </button>
        <button
          onClick={() => (nextStep ? navigate(`/guides/${g.id}/${nextStep.id}`) : navigate('/guides'))}
          className="btn-primary"
        >
          {nextStep ? 'Next →' : 'Done'}
        </button>
      </div>
    </div>
  )
}

