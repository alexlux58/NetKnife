/**
 * ==============================================================================
 * NETKNIFE - TOP BAR
 * ==============================================================================
 * 
 * The top bar displays:
 * - Current path/breadcrumb
 * - Sign out button
 * 
 * It's sticky at the top of the content area.
 * ==============================================================================
 */

import { Link } from 'react-router-dom'
import { logout, isDevMode } from '../../lib/auth'

interface TopbarProps {
  pathname: string
  onMenuClick?: () => void
}

export default function Topbar({ pathname, onMenuClick }: TopbarProps) {
  const devMode = isDevMode()

  return (
    <header
      className="sticky top-0 z-10 border-b border-[#30363d] bg-terminal-bg/95 backdrop-blur-sm"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="px-3 sm:px-4 md:px-6 pb-3 flex items-center justify-between gap-2 min-h-[52px]">
        {/* Hamburger + Path breadcrumb */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          {/* Hamburger - mobile only */}
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="md:hidden flex-shrink-0 p-2 -ml-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-gray-500 hidden sm:inline">NetKnife</span>
            <span className="text-gray-600 hidden sm:inline">/</span>
            <span className="text-gray-300 truncate">
              {pathname.replace('/tools/', '').replace(/-/g, ' ').replace('/', '') || 'home'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <Link to="/settings" className="text-sm text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap">
            Account
          </Link>
          <Link
            to="/pricing"
            className="text-sm text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
          >
            Pricing
          </Link>
          <Link
            to="/tools/report-builder"
            className="text-sm text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
          >
            Reports
          </Link>
          {/* Dev mode indicator - hide on very small */}
          {devMode && (
            <span className="hidden sm:inline-flex text-xs bg-amber-900/50 text-amber-400 px-2 py-1 rounded">
              🔓 Dev
            </span>
          )}
          
          {/* Sign out - touch-friendly */}
          <button
            onClick={() => logout()}
            className="btn-secondary text-sm !py-2.5 !px-3 sm:!px-4 min-h-[44px] touch-manipulation"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}

