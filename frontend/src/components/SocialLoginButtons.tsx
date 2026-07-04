import { loginWithProvider, type SocialIdentityProvider } from '../lib/auth'

const PROVIDER_META: Record<SocialIdentityProvider, { label: string; className: string }> = {
  Google: {
    label: 'Google',
    className: 'hover:border-red-500/50 hover:bg-red-950/20',
  },
  Facebook: {
    label: 'Facebook',
    className: 'hover:border-blue-600/50 hover:bg-blue-950/20',
  },
  GitHub: {
    label: 'GitHub',
    className: 'hover:border-gray-400/50 hover:bg-gray-800/50',
  },
  Microsoft: {
    label: 'Microsoft',
    className: 'hover:border-sky-500/50 hover:bg-sky-950/20',
  },
}

/** Shown when VITE_SOCIAL_IDPS is unset; after terraform apply, match enabled providers. */
const DEFAULT_PROVIDERS: SocialIdentityProvider[] = ['Google', 'Facebook', 'GitHub', 'Microsoft']

function parseEnabledProviders(): SocialIdentityProvider[] {
  const raw = import.meta.env.VITE_SOCIAL_IDPS as string | undefined
  if (!raw?.trim()) return DEFAULT_PROVIDERS
  const allowed = new Set<SocialIdentityProvider>(DEFAULT_PROVIDERS)
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is SocialIdentityProvider => allowed.has(s as SocialIdentityProvider))
}

const ENABLED = parseEnabledProviders()

export default function SocialLoginButtons({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  if (ENABLED.length === 0) return null

  const heading = mode === 'signup' ? 'Or sign up with' : 'Or continue with'

  return (
    <div className="mt-6">
      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#30363d]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#161b22] px-2 text-gray-500">{heading}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ENABLED.map((provider) => {
          const meta = PROVIDER_META[provider]
          return (
            <button
              key={provider}
              type="button"
              onClick={() => loginWithProvider(provider)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-[#30363d] bg-[#21262d] text-sm text-gray-200 transition-colors ${meta.className}`}
            >
              <ProviderIcon provider={provider} />
              {meta.label}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-gray-600 text-center mt-3">
        Social login requires OAuth apps in terraform.tfvars. See docs/SOCIAL-LOGIN-SETUP.md.
      </p>
    </div>
  )
}

function ProviderIcon({ provider }: { provider: SocialIdentityProvider }) {
  switch (provider) {
    case 'Google':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#EA4335" d="M12 10v4h6.16c-.26 1.37-1.04 2.53-2.22 3.31l3.59 2.79C21.08 18.12 22 15.91 22 13c0-1.09-.2-2.14-.55-3.1L12 10z" />
          <path fill="#34A853" d="M5.84 14.09l-1.01.78L2 17.5C3.72 20.43 7.61 22 12 22c3.19 0 5.88-1.05 7.84-2.85l-3.59-2.79c-.98.66-2.23 1.06-4.25 1.06-3.31 0-6.11-2.23-7.11-5.23z" />
          <path fill="#4A90E2" d="M2 6.5C1.34 7.96 1 9.45 1 11s.34 3.04 1 4.5V6.5z" />
          <path fill="#FBBC05" d="M12 4c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.85 1.09 15.19 0 12 0 7.61 0 3.72 1.57 2 4.5l3.84 2.99C6.89 6.23 9.69 4 12 4z" />
        </svg>
      )
    case 'Facebook':
      return (
        <svg className="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      )
    case 'GitHub':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      )
    case 'Microsoft':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#F25022" d="M1 1h10v10H1z" />
          <path fill="#7FBA00" d="M13 1h10v10H13z" />
          <path fill="#00A4EF" d="M1 13h10v10H1z" />
          <path fill="#FFB900" d="M13 13h10v10H13z" />
        </svg>
      )
    default:
      return null
  }
}
