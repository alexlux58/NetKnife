/**
 * User profile API: theme, avatarUrl, bio, displayName.
 * POST /profile { action: "get" } | { action: "update", ... }
 */

import { apiPost } from './api'

export interface UserProfile {
  theme: 'light' | 'dark' | 'system'
  avatarUrl: string | null
  bio: string | null
  displayName: string | null
}

export async function getProfile(): Promise<UserProfile> {
  return apiPost<UserProfile>('/profile', { action: 'get' })
}

export async function updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
  return apiPost<UserProfile>('/profile', { action: 'update', ...patch })
}
