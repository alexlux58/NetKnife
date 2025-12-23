/**
 * ==============================================================================
 * NETKNIFE - APPLICATION SHELL
 * ==============================================================================
 * 
 * The shell provides the main application layout:
 * - Sidebar navigation (desktop)
 * - Top bar with user info
 * - Main content area
 * 
 * LAYOUT:
 * ┌─────────────────────────────────────────┐
 * │  Sidebar  │         Top Bar             │
 * │           ├─────────────────────────────┤
 * │   Tools   │                             │
 * │   List    │       Main Content          │
 * │           │       (Outlet)              │
 * │           │                             │
 * └───────────┴─────────────────────────────┘
 * 
 * The Outlet component from React Router renders the matched child route.
 * ==============================================================================
 */

import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Shell() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text">
      <div className="flex">
        {/* Sidebar - hidden on mobile, visible on md+ */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 min-w-0 md:ml-72">
          {/* Top bar */}
          <Topbar pathname={location.pathname} />

          {/* Page content */}
          <main className="p-4 md:p-6 max-w-6xl">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

