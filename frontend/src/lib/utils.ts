/**
 * ==============================================================================
 * NETKNIFE - UTILITY FUNCTIONS
 * ==============================================================================
 * 
 * Shared utility functions used throughout the application.
 * ==============================================================================
 */

/**
 * Redacts sensitive information from a string
 * Used for "Copy (redacted)" functionality
 * 
 * Redacts:
 * - Bearer tokens in Authorization headers
 * - Passwords in various formats
 * - SNMP community strings
 * - API keys
 * 
 * @param text - String potentially containing secrets
 * @returns String with secrets replaced by ***REDACTED***
 */
export function redactSecrets(text: string): string {
  return text
    // Bearer tokens
    .replace(/(authorization:\s*Bearer\s+)[A-Za-z0-9._-]+/gi, '$1***REDACTED***')
    // Password arguments (-A, -X, --password, etc.)
    .replace(/(-A\s+)(\S+)/g, '$1***REDACTED***')
    .replace(/(-X\s+)(\S+)/g, '$1***REDACTED***')
    .replace(/(--auth-password\s+)(\S+)/gi, '$1***REDACTED***')
    .replace(/(--password\s+)(\S+)/gi, '$1***REDACTED***')
    // Password in key=value format
    .replace(/(password["']?\s*[:=]\s*["']?)([^"'\s]+)/gi, '$1***REDACTED***')
    // SNMP community strings
    .replace(/(-c\s+['"]?)(\S+)/g, '$1***REDACTED***')
    // API keys
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)([^"'\s]+)/gi, '$1***REDACTED***')
}

/**
 * Copies text to clipboard
 * 
 * @param text - Text to copy
 * @returns Promise that resolves when copy is complete
 */
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

/**
 * Formats a JSON object for display
 * 
 * @param obj - Object to format
 * @param spaces - Indentation spaces (default: 2)
 * @returns Formatted JSON string
 */
export function formatJson(obj: unknown, spaces = 2): string {
  try {
    return JSON.stringify(obj, null, spaces)
  } catch {
    return String(obj)
  }
}

/**
 * Classname utility for conditional classes
 * Filters out falsy values and joins remaining classes
 * 
 * @param classes - Array of class names or conditional class expressions
 * @returns Combined class string
 * 
 * @example
 * cn('base', isActive && 'active', hasError && 'error')
 * // Returns: 'base active' if isActive is true and hasError is false
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Debounces a function call
 * 
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

