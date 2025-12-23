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

import { logout, isDevMode } from '../../lib/auth'

interface TopbarProps {
  pathname: string
}

export default function Topbar({ pathname }: TopbarProps) {
  const devMode = isDevMode()

  return (
    <header className="sticky top-0 z-10 border-b border-[#30363d] bg-terminal-bg/90 backdrop-blur-sm">
      <div className="px-4 md:px-6 py-3 flex items-center justify-between">
        {/* Path breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">NetKnife</span>
          <span className="text-gray-600">/</span>
          <span className="text-gray-300 truncate">
            {pathname.replace('/tools/', '').replace('/', '') || 'home'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Dev mode indicator */}
          {devMode && (
            <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-1 rounded">
              🔓 Dev Mode
            </span>
          )}
          
          {/* Sign out button */}
          <button
            onClick={() => logout()}
            className="btn-secondary text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}

