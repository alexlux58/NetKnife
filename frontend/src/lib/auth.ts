/**
 * ==============================================================================
 * NETKNIFE - AUTHENTICATION LIBRARY
 * ==============================================================================
 * 
 * This module handles authentication using OIDC (OpenID Connect) with AWS Cognito.
 * 
 * HOW IT WORKS:
 * 1. User clicks "Sign in" → redirected to Cognito Hosted UI
 * 2. User authenticates with username/password
 * 3. Cognito redirects back to /callback with authorization code
 * 4. We exchange the code for tokens (ID, access, refresh)
 * 5. Tokens are stored in sessionStorage (not localStorage for security)
 * 6. Access token is sent with each API request
 * 
 * WHY SESSION STORAGE?
 * - SessionStorage is cleared when browser tab closes
 * - More secure than localStorage for authentication tokens
 * - Prevents tokens from persisting after user closes browser
 * 
 * FLOW OVERVIEW:
 * - login() → Redirect to Cognito
 * - completeLogin() → Handle callback, exchange code for tokens
 * - logout() → Clear tokens, redirect to Cognito logout
 * - getUser() → Get current authenticated user
 * - getAccessToken() → Get token for API requests
 * 
 * DEV MODE:
 * - When VITE_DEV_BYPASS_AUTH=true, authentication is bypassed
 * - This allows testing the UI without deploying the backend
 * ==============================================================================
 */

import { UserManager, WebStorageStateStore, User } from 'oidc-client-ts'

// Environment variables (set during build)
const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID
const ISSUER = import.meta.env.VITE_COGNITO_ISSUER
const REDIRECT_URI = import.meta.env.VITE_OIDC_REDIRECT_URI
const POST_LOGOUT_REDIRECT_URI = import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI

// Dev bypass mode - skip auth when env vars not configured
const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true' || !CLIENT_ID

// Fake user for dev mode
const DEV_USER = {
  access_token: 'dev-token',
  token_type: 'Bearer',
  profile: {
    sub: 'dev-user',
    email: 'alex.lux@dev.local',
    name: 'Alex Lux (Dev Mode)',
  },
  expired: false,
} as unknown as User

// Create UserManager instance
// This is the main class from oidc-client-ts that handles all OIDC flows
const userManager = new UserManager({
  // Authority is the OIDC issuer URL (Cognito user pool)
  authority: ISSUER,
  
  // Client ID from Cognito app client
  client_id: CLIENT_ID,
  
  // Where to redirect after login
  redirect_uri: REDIRECT_URI,
  
  // Where to redirect after logout
  post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI,
  
  // OAuth 2.0 response type (authorization code flow)
  response_type: 'code',
  
  // OAuth 2.0 scopes
  scope: 'openid email profile',
  
  // Store tokens in sessionStorage (cleared when tab closes)
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  
  // Don't automatically refresh tokens (we'll handle this manually if needed)
  automaticSilentRenew: false,
  
  // Cognito-specific: include metadata for logout
  metadata: {
    issuer: ISSUER,
    authorization_endpoint: `${COGNITO_DOMAIN}/oauth2/authorize`,
    token_endpoint: `${COGNITO_DOMAIN}/oauth2/token`,
    userinfo_endpoint: `${COGNITO_DOMAIN}/oauth2/userInfo`,
    end_session_endpoint: `${COGNITO_DOMAIN}/logout`,
  },
})

/**
 * Initiates login by redirecting to Cognito Hosted UI
 * 
 * This will redirect the browser to Cognito's login page.
 * After successful authentication, Cognito redirects back to /callback
 * 
 * In dev bypass mode, redirects directly to callback to simulate login
 */
export async function login(): Promise<void> {
  // Dev bypass: simulate login by redirecting to callback
  if (DEV_BYPASS_AUTH) {
    console.warn('🔓 DEV MODE: Auth bypassed, simulating login')
    sessionStorage.setItem('dev_authenticated', 'true')
    window.location.href = '/callback'
    return
  }

  try {
    await userManager.signinRedirect()
  } catch (error) {
    console.error('Login redirect failed:', error)
    throw error
  }
}

/**
 * Completes login after redirect from Cognito
 * 
 * This should be called on the /callback page.
 * It exchanges the authorization code for tokens.
 * 
 * In dev bypass mode, returns fake user immediately
 */
export async function completeLogin(): Promise<User | null> {
  // Dev bypass: return fake user
  if (DEV_BYPASS_AUTH) {
    console.warn('🔓 DEV MODE: Auth bypassed, using fake user')
    return DEV_USER
  }

  try {
    const user = await userManager.signinRedirectCallback()
    return user
  } catch (error) {
    console.error('Login callback failed:', error)
    throw error
  }
}

/**
 * Logs out the user
 * 
 * This clears local tokens and redirects to Cognito logout endpoint.
 * The user will be redirected back to the app after logout.
 * 
 * In dev bypass mode, just clears session and redirects to login
 */
export async function logout(): Promise<void> {
  // Dev bypass: clear session and redirect to login
  if (DEV_BYPASS_AUTH) {
    sessionStorage.removeItem('dev_authenticated')
    window.location.href = '/login'
    return
  }

  try {
    // Clear local state
    await userManager.removeUser()
    
    // Redirect to Cognito logout
    // Note: Cognito requires specific logout URL format
    const logoutUrl = new URL(`${COGNITO_DOMAIN}/logout`)
    logoutUrl.searchParams.set('client_id', CLIENT_ID)
    logoutUrl.searchParams.set('logout_uri', POST_LOGOUT_REDIRECT_URI)
    
    window.location.href = logoutUrl.toString()
  } catch (error) {
    console.error('Logout failed:', error)
    // Even if there's an error, try to redirect
    window.location.href = POST_LOGOUT_REDIRECT_URI || '/login'
  }
}

/**
 * Gets the current authenticated user
 * 
 * @returns User object if authenticated, null otherwise
 */
export async function getUser(): Promise<User | null> {
  // Dev bypass: return fake user if "authenticated"
  if (DEV_BYPASS_AUTH) {
    const isDevAuth = sessionStorage.getItem('dev_authenticated') === 'true'
    return isDevAuth ? DEV_USER : null
  }

  try {
    const user = await userManager.getUser()
    
    // Check if user exists and token hasn't expired
    if (user && !user.expired) {
      return user
    }
    
    return null
  } catch (error) {
    console.error('Get user failed:', error)
    return null
  }
}

/**
 * Gets the access token for API requests
 * 
 * @returns Access token string if authenticated, null otherwise
 * 
 * Note: In dev mode, returns 'dev-token' (remote APIs will fail)
 */
export async function getAccessToken(): Promise<string | null> {
  const user = await getUser()
  return user?.access_token ?? null
}

/**
 * Checks if user is currently authenticated
 * 
 * @returns true if authenticated with valid token
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getUser()
  return user !== null && !user.expired
}

/**
 * Check if running in dev bypass mode
 */
export function isDevMode(): boolean {
  return DEV_BYPASS_AUTH
}

