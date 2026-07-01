import { apiPost } from './api'

export interface LabItem {
  labId: string
  status: 'provisioning' | 'running' | 'stopping' | 'terminated' | 'failed'
  instanceId: string | null
  instanceType: string
  sessionMinutes: number
  minutesUsed: number
  creditsReserved: number
  ssmUrl: string | null
  createdAt: string
  startedAt: string | null
  stoppedAt: string | null
  expiresAt: string | null
  ssmOnline?: boolean
}

export interface LabCredits {
  credits: number
  rateCentsPerMinute: number
  rateDisplay?: string
  isExempt?: boolean
  packs?: Array<{ id: string; minutes: number; hours: number; available: boolean }>
}

export async function labsList() {
  return apiPost<{ items: LabItem[] }>('/labs', { action: 'list' })
}

export async function labsLaunch(payload?: { instanceType?: string; sessionMinutes?: number }) {
  return apiPost<{ lab: LabItem }>('/labs', { action: 'launch', ...payload })
}

export async function labsStatus(labId: string) {
  return apiPost<{ lab: LabItem }>('/labs', { action: 'status', labId })
}

export async function labsStop(labId: string) {
  return apiPost<{ lab: LabItem }>('/labs', { action: 'stop', labId })
}

export async function labsCredits() {
  return apiPost<LabCredits>('/labs', { action: 'credits' })
}

export async function labsBuyCredits(pack: 'starter' | 'standard' | 'power') {
  return apiPost<{ url: string }>('/labs', { action: 'buy-credits', pack })
}
