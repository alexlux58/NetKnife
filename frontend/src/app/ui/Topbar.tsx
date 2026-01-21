/**
 * ==============================================================================
 * NETKNIFE - TOP BAR
 * ==============================================================================
 * 
 * The top bar displays:
 * - Current path/breadcrumb
 * - User avatar and display name (from profile)
 * - Account, Pricing, Reports, Sign out
 * 
 * It's sticky at the top of the content area.
 * ==============================================================================
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { logout, isDevMode } from '../../lib/auth'
import { getProfile } from '../../lib/profile'

interface TopbarProps {
  pathname: string
  onMenuClick?: () => void
}

export default function Topbar({ pathname, onMenuClick }: TopbarProps) {
  const devMode = isDevMode()
  const [profile, setProfile] = useState<{ displayName?: string | null; avatarUrl?: string | null } | null>(null)

  useEffect(() => {
    getProfile()
      .then((p) => setProfile(p))
      .catch(() => setProfile(null))
  }, [])

  const label = profile?.displayName?.trim() || 'Account'

  return (
    <header
      className="sticky top-0 z-10 border-b border-[#30363d] bg-terminal-bg/95 backdrop-blur-sm"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="px-3 sm:px-4 md:px-6 pb-3 flex items-center justify-between gap-2 min-h-[52px]">
        {/* Hamburger + Path breadcrumb */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          {/* Hamburger - mobile/tablet only */}
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="lg:hidden flex-shrink-0 p-2 -ml-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-gray-500 hidden md:inline">NetKnife</span>
            <span className="text-gray-600 hidden md:inline">/</span>
            <span className="text-gray-300 truncate">
              {pathname.replace('/tools/', '').replace(/-/g, ' ').replace('/', '') || 'home'}
            </span>
          </div>
        </div>

        {/* User (avatar + name) and actions */}
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 flex-shrink-0">
          <Link
            to="/settings"
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap min-w-0"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 text-gray-400 text-xs" aria-hidden>
                ?
              </span>
            )}
            <span className="hidden md:inline truncate max-w-[120px]">{label}</span>
          </Link>
          <a
            href="https://speed.cloudflare.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:inline text-sm text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
          >
            Speed test
          </a>
          <Link
            to="/pricing"
            className="hidden md:inline text-sm text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
          >
            Pricing
          </Link>
          <Link
            to="/board"
            className="hidden lg:inline text-sm text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
          >
            Board
          </Link>
          <Link
            to="/activity"
            className="hidden lg:inline text-sm text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
          >
            Activity
          </Link>
          <Link
            to="/tools/report-builder"
            className="hidden xl:inline text-sm text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
          >
            Reports
          </Link>
          {/* Dev mode indicator - hide on very small */}
          {devMode && (
            <span className="hidden md:inline-flex text-xs bg-amber-900/50 text-amber-400 px-2 py-1 rounded">
              🔓 Dev
            </span>
          )}
          
          {/* Sign out - touch-friendly */}
          <button
            onClick={() => logout()}
            className="btn-secondary text-sm !py-2.5 !px-2 sm:!px-3 lg:!px-4 min-h-[44px] touch-manipulation"
          >
            <span className="hidden sm:inline">Sign out</span>
            <span className="sm:hidden">Out</span>
          </button>
        </div>
      </div>
    </header>
  )
}

