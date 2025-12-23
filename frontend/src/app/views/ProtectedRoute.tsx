/**
 * ==============================================================================
 * NETKNIFE - PROTECTED ROUTE WRAPPER
 * ==============================================================================
 * 
 * This component wraps routes that require authentication.
 * 
 * BEHAVIOR:
 * - Shows loading state while checking authentication
 * - Redirects to /login if not authenticated
 * - Renders children if authenticated
 * 
 * USAGE:
 * ```tsx
 * <ProtectedRoute>
 *   <YourProtectedComponent />
 * </ProtectedRoute>
 * ```
 * ==============================================================================
 */

import { ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getUser } from '../../lib/auth'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  // State to track loading and authentication status
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await getUser()
        setIsAuthenticated(user !== null && !user.expired)
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-terminal-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-sm text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Render protected content
  return <>{children}</>
}

