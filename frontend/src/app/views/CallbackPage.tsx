/**
 * ==============================================================================
 * NETKNIFE - OAUTH CALLBACK PAGE
 * ==============================================================================
 * 
 * This page handles the OAuth callback after Cognito authentication.
 * 
 * FLOW:
 * 1. User authenticates on Cognito Hosted UI
 * 2. Cognito redirects to /callback?code=xxx&state=xxx
 * 3. This page calls completeLogin() to exchange code for tokens
 * 4. On success, redirect to main application
 * 5. On failure, show error and link to retry
 * ==============================================================================
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeLogin } from '../../lib/auth'

export default function CallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      try {
        // Exchange authorization code for tokens
        await completeLogin()
        
        // Redirect to main app
        navigate('/', { replace: true })
      } catch (err) {
        console.error('Login callback failed:', err)
        
        // Provide more helpful error message for state errors
        let errorMessage = 'Login failed'
        if (err instanceof Error) {
          if (err.message.includes('state') || err.message.includes('No matching state')) {
            errorMessage = 'Authentication session expired. This can happen if you opened the login page in a new tab or your browser cleared session data. Please try logging in again from the main page.'
          } else {
            errorMessage = err.message
          }
        }
        
        setError(errorMessage)
      }
    }

    handleCallback()
  }, [navigate])

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-terminal-bg">
        <div className="card p-8 max-w-md w-full text-center">
          {/* Error icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-900/50 text-red-400 mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-red-400 mb-2">
            Authentication Failed
          </h1>
          
          <p className="text-gray-400 mb-6">
            {error}
          </p>

          <a
            href="/login"
            className="btn-primary inline-block"
          >
            Try Again
          </a>
        </div>
      </div>
    )
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-terminal-bg">
      <div className="text-center">
        {/* Loading spinner */}
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
        
        <h2 className="text-lg font-medium mb-2">Completing sign in...</h2>
        <p className="text-sm text-gray-400">Please wait while we verify your credentials.</p>
      </div>
    </div>
  )
}

