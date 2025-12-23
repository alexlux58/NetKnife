/**
 * ==============================================================================
 * NETKNIFE - API CLIENT LIBRARY
 * ==============================================================================
 * 
 * This module provides a typed API client for communicating with the backend.
 * 
 * FEATURES:
 * - Automatic token injection for authenticated requests
 * - Error handling with typed ApiError class
 * - JSON parsing and serialization
 * - TypeScript generics for type-safe responses
 * 
 * USAGE:
 * ```typescript
 * const result = await apiPost<DnsResult>('/dns', { name: 'example.com', type: 'A' })
 * ```
 * 
 * ERROR HANDLING:
 * All errors are thrown as ApiError instances with status code and body.
 * ```typescript
 * try {
 *   const result = await apiPost('/dns', {...})
 * } catch (error) {
 *   if (error instanceof ApiError) {
 *     console.log(error.status, error.body)
 *   }
 * }
 * ```
 * ==============================================================================
 */

import { getAccessToken } from './auth'

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL

/**
 * Custom error class for API errors
 * Includes HTTP status code and parsed response body
 */
export class ApiError extends Error {
  /** HTTP status code */
  status: number
  /** Parsed response body */
  body: unknown

  constructor(status: number, body: unknown) {
    super(`API error: ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/**
 * Makes an authenticated POST request to the API
 * 
 * @param path - API endpoint path (e.g., '/dns')
 * @param body - Request body (will be JSON serialized)
 * @returns Parsed JSON response
 * @throws ApiError if request fails or returns non-2xx status
 * 
 * @example
 * ```typescript
 * interface DnsResult {
 *   name: string
 *   type: string
 *   answer: Array<{ data: string }>
 * }
 * 
 * const result = await apiPost<DnsResult>('/dns', {
 *   name: 'example.com',
 *   type: 'A'
 * })
 * ```
 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  // Get access token for authentication
  const token = await getAccessToken()
  
  if (!token) {
    throw new ApiError(401, { error: 'Not authenticated' })
  }

  // Make the request
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  // Parse response body
  const text = await response.text()
  let data: unknown = null
  
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // If not valid JSON, wrap raw text
    data = { raw: text }
  }

  // Check for errors
  if (!response.ok) {
    throw new ApiError(response.status, data)
  }

  return data as T
}

/**
 * Makes an authenticated GET request to the API
 * (Currently not used, but included for completeness)
 */
export async function apiGet<T>(path: string): Promise<T> {
  const token = await getAccessToken()
  
  if (!token) {
    throw new ApiError(401, { error: 'Not authenticated' })
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers: {
      'authorization': `Bearer ${token}`,
    },
  })

  const text = await response.text()
  let data: unknown = null
  
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    throw new ApiError(response.status, data)
  }

  return data as T
}

/**
 * API client object with method shortcuts
 * Provides a more convenient interface for making API calls
 * 
 * @example
 * ```typescript
 * const result = await apiClient.post('/dns', { name: 'example.com' })
 * ```
 */
export const apiClient = {
  post: apiPost,
  get: apiGet,
}

