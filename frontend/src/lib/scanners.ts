import { apiPost } from './api'

export interface ScannerConfig {
  scannerId: string
  type: string
  name: string
  endpoint?: string
  secretRef?: string
  status?: string
  lastHealthCheck?: number | null
}

export interface ScanItem {
  scanId: string
  scannerType: 'cloud' | 'agent'
  scannerId?: string | null
  target: string
  scanProfile: string
  status: string
  findings?: any[]
  createdAt?: number
  completedAt?: number | null
}

export async function scannersListConfigs() {
  return apiPost<{ items: ScannerConfig[] }>('/scanners', { action: 'listScannerConfigs' })
}

export async function scannersSaveConfig(payload: { scannerId: string; type: string; name?: string; endpoint?: string; secretRef?: string }) {
  return apiPost<{ success: boolean; config: ScannerConfig }>('/scanners', { action: 'saveScannerConfig', ...payload })
}

export async function scannersDeleteConfig(scannerId: string) {
  return apiPost<{ success: boolean }>('/scanners', { action: 'deleteScannerConfig', scannerId })
}

export async function scannersRunScan(payload: { scannerType: 'cloud' | 'agent'; target: string; scanProfile?: string; scannerId?: string }) {
  return apiPost<{ scan: ScanItem }>('/scanners', { action: 'scan', ...payload })
}

export async function scannersListScans() {
  return apiPost<{ items: ScanItem[] }>('/scanners', { action: 'listScans' })
}

