/**
 * ==============================================================================
 * NETKNIFE - APPLICATION SHELL
 * ==============================================================================
 */

import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ReportProvider } from '../../lib/reportContext'
import { BillingProvider } from '../../lib/BillingContext'
import { GuideProvider } from '../../lib/GuideContext'
import { recordRecentTool } from '../../lib/toolNavigation'
import { tools } from '../../tools/registry'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import CommandPalette from './CommandPalette'
import { useCommandPaletteShortcut } from '../../lib/useCommandPaletteShortcut'
import UpgradeModal from '../../components/UpgradeModal'
import AssistantChat from '../../components/AssistantChat'

export default function Shell() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  useCommandPaletteShortcut(openPalette)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const match = tools.find((t) => location.pathname === t.path || location.pathname.startsWith(`${t.path}/`))
    if (match) recordRecentTool(match.id)
  }, [location.pathname])

  return (
    <BillingProvider>
      <ReportProvider>
        <GuideProvider>
        <div className="min-h-screen min-h-[100dvh] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <div className="flex">
          <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex-1 min-w-0 lg:ml-72">
            <Topbar
              pathname={location.pathname}
              onMenuClick={() => setSidebarOpen(true)}
              onSearchClick={openPalette}
            />

            <main className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-6xl mx-auto w-full">
              <Outlet />
            </main>
          </div>
        </div>
        </div>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <UpgradeModal />
        <AssistantChat />
        </GuideProvider>
      </ReportProvider>
    </BillingProvider>
  )
}
