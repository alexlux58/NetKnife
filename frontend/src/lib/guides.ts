import { apiPost } from './api'

export interface GuideProgressItem {
  guideId: string
  stepId: string
  completed: boolean
  completedAt: number | null
  notes: string
  findings: any[]
  scanResults: any[]
  toolResults: Record<string, any>
  shared?: boolean
  collaborators?: string[]
  lastViewedAt?: number
  updatedAt?: number
}

export async function guidesGetProgress(guideId: string, stepId?: string) {
  return apiPost<{ progress: GuideProgressItem | GuideProgressItem[] | null }>('/guides', {
    action: 'getProgress',
    guideId,
    stepId,
  })
}

export async function guidesSaveProgress(payload: {
  guideId: string
  stepId: string
  completed?: boolean
  notes?: string
  findings?: any[]
  scanResults?: any[]
  toolResults?: Record<string, any>
  shared?: boolean
  collaborators?: string[]
}) {
  return apiPost<{ success: boolean; progress: GuideProgressItem }>('/guides', {
    action: 'saveProgress',
    ...payload,
  })
}

export async function guidesListProgress() {
  return apiPost<{ items: GuideProgressItem[] }>('/guides', { action: 'listProgress' })
}

export async function guidesRateContent(payload: {
  guideId: string
  stepId: string
  version?: string
  rating: number
  feedback?: string
}) {
  return apiPost<{ success: boolean; averageRating: number }>('/guides', {
    action: 'rateContent',
    ...payload,
  })
}

