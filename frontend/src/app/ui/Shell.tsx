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

import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ReportProvider } from '../../lib/reportContext'
import { BillingProvider } from '../../lib/BillingContext'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import UpgradeModal from '../../components/UpgradeModal'
import AssistantChat from '../../components/AssistantChat'

export default function Shell() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <BillingProvider>
      <ReportProvider>
        <div className="min-h-screen min-h-[100dvh] bg-terminal-bg text-terminal-text">
        <div className="flex">
          <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex-1 min-w-0 lg:ml-72">
            <Topbar pathname={location.pathname} onMenuClick={() => setSidebarOpen(true)} />

            <main className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-6xl mx-auto w-full">
              <Outlet />
            </main>
          </div>
        </div>
        </div>
        <UpgradeModal />
        <AssistantChat />
      </ReportProvider>
    </BillingProvider>
  )
}

