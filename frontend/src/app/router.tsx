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
import { createBrowserRouter, Navigate } from 'react-router-dom'
import Shell from './ui/Shell'
import LoginPage from './views/LoginPage'
import CallbackPage from './views/CallbackPage'
import ProtectedRoute from './views/ProtectedRoute'
import { tools } from '../tools/registry'

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
 * Handles lazy loading of tool components based on tool ID
 */
function ToolLoader({ id }: { id: string }) {
  const tool = tools.find((t) => t.id === id)
  
  if (!tool) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Tool not found</h2>
        <p className="text-gray-400 mt-2">The requested tool does not exist.</p>
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
  // Public routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/callback',
    element: <CallbackPage />,
  },

  // Protected routes (require authentication)
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Shell />
      </ProtectedRoute>
    ),
    children: [
      // Redirect root to default tool
      {
        index: true,
        element: <Navigate to={defaultToolPath} replace />,
      },
      // Generate routes for each tool
      ...tools.map((tool) => ({
        path: tool.path.replace(/^\//, ''),
        element: <ToolLoader id={tool.id} />,
      })),
    ],
  },

  // Catch-all: redirect to home
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

