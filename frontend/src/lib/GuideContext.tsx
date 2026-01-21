import React, { createContext, useContext, useMemo, useState } from 'react'
import type { Guide, GuideStep } from '../guides/registry'
import { guidesGetProgress, guidesSaveProgress, type GuideProgressItem } from './guides'

interface GuideContextType {
  guide: Guide | null
  step: GuideStep | null
  progressByStepId: Record<string, GuideProgressItem>
  setGuideAndStep: (guide: Guide, step: GuideStep) => void
  refreshGuideProgress: (guideId: string) => Promise<void>
  saveStepProgress: (payload: {
    guideId: string
    stepId: string
    completed?: boolean
    notes?: string
    findings?: any[]
    scanResults?: any[]
    toolResults?: Record<string, any>
    shared?: boolean
    collaborators?: string[]
  }) => Promise<void>
}

const GuideContext = createContext<GuideContextType | null>(null)

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [guide, setGuide] = useState<Guide | null>(null)
  const [step, setStep] = useState<GuideStep | null>(null)
  const [progressByStepId, setProgressByStepId] = useState<Record<string, GuideProgressItem>>({})

  const setGuideAndStep = (g: Guide, s: GuideStep) => {
    setGuide(g)
    setStep(s)
  }

  const refreshGuideProgress = async (guideId: string) => {
    const res = await guidesGetProgress(guideId)
    const items = Array.isArray(res.progress) ? res.progress : res.progress ? [res.progress] : []
    const map: Record<string, GuideProgressItem> = {}
    for (const it of items) {
      map[it.stepId] = it
    }
    setProgressByStepId(map)
  }

  const saveStepProgress = async (payload: {
    guideId: string
    stepId: string
    completed?: boolean
    notes?: string
    findings?: any[]
    scanResults?: any[]
    toolResults?: Record<string, any>
    shared?: boolean
    collaborators?: string[]
  }) => {
    const res = await guidesSaveProgress(payload)
    setProgressByStepId((prev) => ({ ...prev, [res.progress.stepId]: res.progress }))
  }

  const value = useMemo<GuideContextType>(
    () => ({
      guide,
      step,
      progressByStepId,
      setGuideAndStep,
      refreshGuideProgress,
      saveStepProgress,
    }),
    [guide, step, progressByStepId]
  )

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>
}

export function useGuide() {
  const c = useContext(GuideContext)
  if (!c) {
    return {
      guide: null,
      step: null,
      progressByStepId: {},
      setGuideAndStep: () => {},
      refreshGuideProgress: async () => {},
      saveStepProgress: async () => {},
    } as GuideContextType
  }
  return c
}

