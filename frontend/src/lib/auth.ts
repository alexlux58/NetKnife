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
 * - login() → Redirect to Cognito Hosted UI (sign-in)
 * - signup() → Redirect to Cognito Hosted UI (sign-up; uses same /oauth2/authorize, hint for sign-up tab when supported)
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

// Dev bypass: only in Vite dev (import.meta.env.DEV) when Cognito not configured.
// In production builds (import.meta.env.DEV === false) we never bypass, even if
// VITE_DEV_BYPASS_AUTH is set. Do not set VITE_DEV_BYPASS_AUTH in production.
const DEV_BYPASS_AUTH =
  import.meta.env.DEV && (!CLIENT_ID || import.meta.env.VITE_DEV_BYPASS_AUTH === 'true')

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
  // IMPORTANT: State is stored with a prefix to avoid conflicts
  userStore: new WebStorageStateStore({ 
    store: window.sessionStorage,
    prefix: 'oidc.' // Prefix for state storage keys
  }),
  
  // Don't automatically refresh tokens (we'll handle this manually if needed)
  automaticSilentRenew: false,
  
  // Additional settings to help with state management
  loadUserInfo: false, // Don't load user info automatically
  filterProtocolClaims: true, // Filter protocol claims from tokens
  
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
 * Initiates sign-up by redirecting to Cognito Hosted UI.
 * Uses the same /oauth2/authorize as login; the Hosted UI shows both
 * "Sign in" and "Sign up" when self-signup is enabled. Do not pass
 * extraQueryParams Cognito does not support (e.g. screen_hint) — they cause 400.
 *
 * In dev bypass mode, behaves like login (simulates auth).
 */
export async function signup(): Promise<void> {
  if (DEV_BYPASS_AUTH) {
    console.warn('🔓 DEV MODE: Auth bypassed, simulating signup as login')
    sessionStorage.setItem('dev_authenticated', 'true')
    window.location.href = '/callback'
    return
  }

  try {
    await userManager.signinRedirect()
  } catch (error) {
    console.error('Signup redirect failed:', error)
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
    // Get the state from URL parameters to help debug
    const urlParams = new URLSearchParams(window.location.search)
    const stateParam = urlParams.get('state')
    const codeParam = urlParams.get('code')
    
    console.log('Callback received:', { 
      hasState: !!stateParam, 
      hasCode: !!codeParam,
      redirectUri: REDIRECT_URI 
    })
    
    // Check if state exists in storage before calling callback
    const stateKey = `oidc.${CLIENT_ID}:${REDIRECT_URI}:state`
    const storedState = sessionStorage.getItem(stateKey)
    console.log('State check:', { 
      stateKey, 
      hasStoredState: !!storedState,
      urlState: stateParam 
    })
    
    const user = await userManager.signinRedirectCallback()
    return user
  } catch (error) {
    console.error('Login callback failed:', error)
    
    // If it's a state mismatch error, provide more helpful message
    if (error instanceof Error && error.message.includes('state')) {
      console.error('State mismatch - this can happen if:')
      console.error('1. You opened the login page in a new tab/window')
      console.error('2. Your browser cleared sessionStorage')
      console.error('3. You navigated away during authentication')
      console.error('Solution: Try logging in again from the main page')
    }
    
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
 * Gets the Cognito username (for billing/superuser checks).
 * @returns Username string, or '' if not available.
 */
export async function getUsername(): Promise<string> {
  const user = await getUser()
  const p = (user?.profile || {}) as Record<string, unknown>
  return String(p['cognito:username'] || p['preferred_username'] || '')
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

/**
 * Derive Cognito region from ISSUER (e.g. https://cognito-idp.us-west-2.amazonaws.com/...)
 * or VITE_REGION. Used for SignUp and other cognito-idp API calls.
 */
export function getCognitoRegion(): string {
  const region = import.meta.env.VITE_REGION
  if (region && typeof region === 'string') return region
  const m = ISSUER && typeof ISSUER === 'string' ? ISSUER.match(/cognito-idp\.([^.]+)\.amazonaws\.com/) : null
  return m ? m[1] : 'us-west-2'
}

export interface SignUpAttributes {
  username: string
  password: string
  email: string
  phone?: string
}

/**
 * Sign up a new user via Cognito SignUp API with email and optional phone.
 * Use this instead of redirecting to Hosted UI so we can collect email/phone
 * (Hosted UI often omits optional attributes). After success, user must sign in.
 * PreSignUp/PostConfirmation triggers run as usual; email/phone are stored and notified.
 *
 * @throws Error with message from Cognito (e.g. UsernameExistsException, InvalidPasswordException,
 *         or "Sign-up is currently disabled" from PreSignUp failsafe)
 */
export async function signUpWithAttributes(params: SignUpAttributes): Promise<void> {
  if (DEV_BYPASS_AUTH) {
    console.warn('🔓 DEV MODE: SignUp bypassed')
    throw new Error('Sign-up is disabled in dev mode. Use Sign in with dev bypass.')
  }
  if (!CLIENT_ID || !ISSUER) {
    throw new Error('Cognito is not configured. Set VITE_COGNITO_CLIENT_ID and VITE_COGNITO_ISSUER.')
  }

  const attrs: { Name: string; Value: string }[] = []
  if (params.email && String(params.email).trim()) {
    attrs.push({ Name: 'email', Value: String(params.email).trim() })
  }
  if (params.phone && String(params.phone).trim()) {
    attrs.push({ Name: 'phone_number', Value: String(params.phone).trim() })
  }

  const region = getCognitoRegion()
  const url = `https://cognito-idp.${region}.amazonaws.com/`
  const body = {
    ClientId: CLIENT_ID,
    Username: params.username,
    Password: params.password,
    UserAttributes: attrs,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let json: { __type?: string; message?: string } = {}
  try {
    json = JSON.parse(text)
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = json.message || json.__type || text || `SignUp failed (${res.status})`
    throw new Error(msg)
  }
}

