/**
 * ==============================================================================
 * NETKNIFE - ROUTER CONFIGURATION
 * ==============================================================================
 * 
 * This file defines the application's routing structure using React Router v6.
 * 
 * ROUTE STRUCTURE:
 * - /login - Login page (unauthenticated)
 * - /callback - OAuth callback handler
 * - / - Main application shell (authenticated, protected)
 *   - /tools/subnet - Subnet calculator
 *   - /tools/regex - Regex helper
 *   - /tools/cmdlib - Command templates
 *   - /tools/dns - DNS lookup
 *   - /tools/rdap - RDAP lookup
 *   - /tools/tls - TLS inspector
 *   - /tools/headers - HTTP headers scanner
 *   - /tools/peeringdb - PeeringDB query
 * 
 * PROTECTION:
 * The main application routes are wrapped in ProtectedRoute which:
 * - Checks for valid authentication
 * - Redirects to /login if not authenticated
 * ==============================================================================
 */

import { Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import Shell from './ui/Shell'
import LoginPage from './views/LoginPage'
import SignUpPage from './views/SignUpPage'
import CallbackPage from './views/CallbackPage'
import ProtectedRoute from './views/ProtectedRoute'
import NotFoundPage from './views/NotFoundPage'
import PricingPage from './views/PricingPage'
import SettingsPage from './views/SettingsPage'
import AlarmsPage from './views/AlarmsPage'
import BoardPage from './views/BoardPage'
import ActivityPage from './views/ActivityPage'
import PrivacyPage from './views/PrivacyPage'
import CookieConsent from '../components/CookieConsent'
import { Link } from 'react-router-dom'
import { tools } from '../tools/registry'
import { useBilling } from '../lib/BillingContext'

/**
 * Root layout: renders the matched route (Outlet) and CookieConsent on every page.
 * CookieConsent must be inside the Router so its <Link> components have router context.
 */
function AppLayout() {
  return (
    <>
      <Outlet />
      <CookieConsent />
    </>
  )
}

/**
 * Loading fallback component
 * Displayed while lazy-loaded components are being fetched
 */
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
        <p className="text-sm text-gray-400">Loading tool...</p>
      </div>
    </div>
  )
}

/**
 * Tool loader component
 * Handles lazy loading of tool components based on tool ID.
 * Remote tools require Pro; free users see an upgrade CTA.
 */
function ToolLoader({ id }: { id: string }) {
  const { canUseRemote } = useBilling()
  const tool = tools.find((t) => t.id === id)

  if (!tool) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Tool not found</h2>
        <p className="text-gray-400 mt-2">The requested tool does not exist.</p>
      </div>
    )
  }

  if (tool.kind === 'remote' && !canUseRemote) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{tool.name}</h1>
          {tool.description && <p className="text-gray-400 mt-1">{tool.description}</p>}
        </div>
        <div className="card p-8 text-center">
          <p className="text-gray-400 mb-4">This tool uses AWS/remote APIs. Subscribe to API Access ($5/mo) to use it.</p>
          <Link to="/pricing" className="btn-primary">
            View plans &amp; subscribe
          </Link>
        </div>
      </div>
    )
  }

  const Component = tool.component

  return (
    <Suspense fallback={<LoadingFallback />}>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{tool.name}</h1>
          {tool.description && (
            <p className="text-gray-400 mt-1">{tool.description}</p>
          )}
        </div>
        <Component />
      </div>
    </Suspense>
  )
}

// Get default tool path (first tool in registry)
const defaultToolPath = tools[0]?.path ?? '/tools/subnet'

/**
 * Application router configuration
 */
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      // Public routes
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignUpPage /> },
      { path: '/callback', element: <CallbackPage /> },
      { path: '/privacy', element: <PrivacyPage /> },

      // Protected routes (require authentication)
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to={defaultToolPath} replace />,
          },
          { path: 'pricing', element: <PricingPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'alarms', element: <AlarmsPage /> },
          { path: 'board', element: <BoardPage /> },
          { path: 'activity', element: <ActivityPage /> },
          ...tools.map((tool) => ({
            path: tool.path.replace(/^\//, ''),
            element: <ToolLoader id={tool.id} />,
          })),
          // 404 for unknown paths (e.g. /tools/nonexistent) – rendered inside Shell
          { path: '*', element: <NotFoundPage /> },
        ],
      },

      // Top-level catch-all (e.g. /random) – 404 without Shell
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

