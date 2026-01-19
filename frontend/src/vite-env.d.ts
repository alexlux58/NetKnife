/// <reference types="vite/client" />

/**
 * Vite environment variable type definitions
 * These define the shape of import.meta.env for TypeScript
 */
interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_COGNITO_DOMAIN: string
  readonly VITE_COGNITO_CLIENT_ID: string
  readonly VITE_COGNITO_ISSUER: string
  readonly VITE_OIDC_REDIRECT_URI: string
  readonly VITE_OIDC_POST_LOGOUT_REDIRECT_URI: string
  readonly VITE_REGION: string
  readonly VITE_DEV_BYPASS_AUTH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Google Analytics / gtag.js (CookieConsent) */
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
  }
}

