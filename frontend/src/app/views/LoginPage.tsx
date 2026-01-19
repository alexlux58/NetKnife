/**
 * ==============================================================================
 * NETKNIFE - LOGIN PAGE
 * ==============================================================================
 * 
 * The login page displays:
 * - NetKnife branding
 * - Sign in and Create account
 * - Notice about account access
 *
 * Sign in and Create account redirect to the Cognito Hosted UI (sign-up visible
 * when allowed by the user pool; otherwise contact administrator).
 * ==============================================================================
 */

import { Link } from 'react-router-dom'
import { login, isDevMode } from '../../lib/auth'

export default function LoginPage() {
  const devMode = isDevMode()

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-terminal-bg">
      {/* Decorative background grid */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(rgba(88, 166, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(88, 166, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      
      {/* Dev mode banner */}
      {devMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-amber-900/80 border border-amber-600 text-amber-200 px-4 py-2 rounded-lg text-sm">
            🔓 <strong>Dev Mode</strong> - Auth bypassed (no .env.local configured)
          </div>
        </div>
      )}

      {/* Login card */}
      <div className="relative w-full max-w-md">
        <div className="card p-8">
          {/* Logo and title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
              <svg 
                className="w-8 h-8 text-white" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" 
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gradient">NetKnife</h1>
            <p className="text-gray-400 mt-2">
              Network &amp; Security Swiss Army Knife
            </p>
          </div>

          {/* Description */}
          <div className="mb-8 space-y-3">
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <span className="text-terminal-green">✓</span>
              <span>Subnet calculations, CIDR tools</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <span className="text-terminal-green">✓</span>
              <span>DNS, RDAP, TLS inspection</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <span className="text-terminal-green">✓</span>
              <span>Multi-vendor command templates</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <span className="text-terminal-green">✓</span>
              <span>Security headers analysis</span>
            </div>
          </div>

          {/* Sign in button */}
          <button
            onClick={() => login()}
            className="w-full btn-primary py-3 text-base font-semibold"
          >
            Sign in
          </button>

          {/* Create account - use /signup so we collect email and phone (Hosted UI often omits them) */}
          <p className="text-center mt-4 text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium hover:underline">
              Create account
            </Link>
          </p>

          {/* Notice */}
          <p className="text-xs text-gray-500 text-center mt-6">
            Private tools. If sign-up is not available, contact the administrator for access.
          </p>
        </div>

        {/* Version info */}
        <p className="text-xs text-gray-600 text-center mt-4">
          NetKnife v1.0.0 • Secured by AWS Cognito
        </p>
      </div>
    </div>
  )
}

