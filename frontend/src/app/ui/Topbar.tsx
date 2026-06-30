/**
 * ==============================================================================
 * NETKNIFE - TOP BAR
 * ==============================================================================
 */

import { useEffect, useState } from 'react'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { getProfile, PROFILE_UPDATED_EVENT } from '../../lib/profile'
import UserMenu from './UserMenu'

interface TopbarProps {
  pathname: string
  onMenuClick?: () => void
  onSearchClick?: () => void
}

function breadcrumbLabel(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'home'
  if (pathname.startsWith('/tools/')) {
    return pathname.replace('/tools/', '').replace(/-/g, ' ')
  }
  return pathname.replace(/^\//, '').replace(/-/g, ' ')
}

export default function Topbar({ pathname, onMenuClick, onSearchClick }: TopbarProps) {
  const [profile, setProfile] = useState<{ displayName?: string | null; avatarUrl?: string | null } | null>(null)

  useEffect(() => {
    getProfile()
      .then((p) => setProfile(p))
      .catch(() => setProfile(null))

    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail) setProfile(detail)
    }
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated)
  }, [])

  const label = profile?.displayName?.trim() || 'Account'

  return (
    <header
      className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/95 backdrop-blur-sm"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="px-3 sm:px-4 md:px-6 pb-3 flex items-center justify-between gap-2 min-h-[52px]">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="lg:hidden flex-shrink-0 p-2 -ml-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-[var(--color-text-muted)] hidden md:inline">NetKnife</span>
            <span className="text-[var(--color-text-muted)] hidden md:inline">/</span>
            <span className="text-[var(--color-text-primary)] truncate capitalize">
              {breadcrumbLabel(pathname)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {onSearchClick && (
            <button
              type="button"
              onClick={onSearchClick}
              className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent-blue)] min-h-[44px] touch-manipulation"
              aria-label="Search tools (Command K)"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Search</span>
              <kbd className="hidden md:inline text-[10px] font-mono border border-[var(--color-border)] rounded px-1 py-0.5">
              ⌘
              K
              </kbd>
            </button>
          )}
          <UserMenu displayName={label} avatarUrl={profile?.avatarUrl} />
        </div>
      </div>
    </header>
  )
}
