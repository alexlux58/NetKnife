/**
 * ==============================================================================
 * NETKNIFE - TOOL REGISTRY
 * ==============================================================================
 * 
 * This file defines all available tools in the application.
 * Each tool is registered with:
 * - Unique ID
 * - Display name
 * - Tool kind (offline or remote)
 * - Group for navigation
 * - Route path
 * - Lazy-loaded component
 * - Description
 * 
 * TOOL KINDS:
 * - offline: Runs entirely in the browser (no backend calls)
 * - remote: Calls AWS Lambda backend (data leaves browser)
 * 
 * LAZY LOADING:
 * All tool components are lazy-loaded using React.lazy().
 * This reduces initial bundle size and improves load time.
 * ==============================================================================
 */

import React from 'react'

/**
 * Tool kind determines where the tool runs
 * - offline: Browser only, no data sent to server
 * - remote: Calls backend API (data sent to AWS)
 */
export type ToolKind = 'offline' | 'remote'

/**
 * Tool definition interface
 */
export interface Tool {
  /** Unique identifier */
  id: string
  /** Display name */
  name: string
  /** Where the tool runs */
  kind: ToolKind
  /** Navigation group */
  group: string
  /** Route path */
  path: string
  /** Lazy-loaded component */
  component: React.LazyExoticComponent<() => JSX.Element>
  /** Short description */
  description?: string
}

/**
 * All registered tools
 * Order determines display order in sidebar
 */
export const tools: Tool[] = [
  // ============================================================================
  // OFFLINE TOOLS (Browser-only, no data sent to server)
  // ============================================================================
  {
    id: 'subnet',
    name: 'Subnet / CIDR',
    kind: 'offline',
    group: 'Offline',
    path: '/tools/subnet',
    component: React.lazy(() => import('./offline/SubnetTool')),
    description: 'IPv4/IPv6 subnet calculator - sipcalc style',
  },
  {
    id: 'regex',
    name: 'Regex Helper',
    kind: 'offline',
    group: 'Offline',
    path: '/tools/regex',
    component: React.lazy(() => import('./offline/RegexTool')),
    description: 'Build and test grep/egrep patterns',
  },
  {
    id: 'cmdlib',
    name: 'Command Templates',
    kind: 'offline',
    group: 'Offline',
    path: '/tools/cmdlib',
    component: React.lazy(() => import('./offline/CommandTemplatesTool')),
    description: 'Multi-vendor CLI command library',
  },
  {
    id: 'password',
    name: 'Password Generator',
    kind: 'offline',
    group: 'Offline',
    path: '/tools/password',
    component: React.lazy(() => import('./offline/PasswordTool')),
    description: 'Cryptographically secure password generator',
  },
  {
    id: 'jwt',
    name: 'JWT Decoder',
    kind: 'offline',
    group: 'Offline',
    path: '/tools/jwt',
    component: React.lazy(() => import('./offline/JwtDecoderTool')),
    description: 'Decode and inspect JSON Web Tokens',
  },
  {
    id: 'encoder',
    name: 'Encoder/Decoder',
    kind: 'offline',
    group: 'Offline',
    path: '/tools/encoder',
    component: React.lazy(() => import('./offline/EncoderTool')),
    description: 'Base64, Hex, URL, HTML encoding',
  },
  {
    id: 'hash',
    name: 'Hash Generator',
    kind: 'offline',
    group: 'Offline',
    path: '/tools/hash',
    component: React.lazy(() => import('./offline/HashTool')),
    description: 'MD5, SHA-1, SHA-256, SHA-512 hashes',
  },
  {
    id: 'timestamp',
    name: 'Timestamp Converter',
    kind: 'offline',
    group: 'Offline',
    path: '/tools/timestamp',
    component: React.lazy(() => import('./offline/TimestampTool')),
    description: 'Unix timestamp ↔ human-readable dates',
  },

  // ============================================================================
  // REMOTE TOOLS (AWS-backed, data sent to Lambda)
  // ============================================================================
  {
    id: 'dns',
    name: 'DNS Lookup',
    kind: 'remote',
    group: 'Remote (AWS)',
    path: '/tools/dns',
    component: React.lazy(() => import('./remote/DnsTool')),
    description: 'DNS-over-HTTPS resolver via Cloudflare',
  },
  {
    id: 'rdap',
    name: 'RDAP Lookup',
    kind: 'remote',
    group: 'Remote (AWS)',
    path: '/tools/rdap',
    component: React.lazy(() => import('./remote/RdapTool')),
    description: 'IP and domain registration data (WHOIS replacement)',
  },
  {
    id: 'tls',
    name: 'TLS Inspector',
    kind: 'remote',
    group: 'Remote (AWS)',
    path: '/tools/tls',
    component: React.lazy(() => import('./remote/TlsTool')),
    description: 'Certificate chain and expiry checker',
  },
  {
    id: 'headers',
    name: 'HTTP Headers',
    kind: 'remote',
    group: 'Remote (AWS)',
    path: '/tools/headers',
    component: React.lazy(() => import('./remote/HeadersTool')),
    description: 'Security headers scanner',
  },
  {
    id: 'peeringdb',
    name: 'PeeringDB',
    kind: 'remote',
    group: 'Remote (AWS)',
    path: '/tools/peeringdb',
    component: React.lazy(() => import('./remote/PeeringDbTool')),
    description: 'Network and IX information lookup',
  },
  {
    id: 'reverse-dns',
    name: 'Reverse DNS (PTR)',
    kind: 'remote',
    group: 'Remote (AWS)',
    path: '/tools/reverse-dns',
    component: React.lazy(() => import('./remote/ReverseDnsTool')),
    description: 'PTR record lookup for IP addresses',
  },
  {
    id: 'email-auth',
    name: 'Email Auth Check',
    kind: 'remote',
    group: 'Remote (AWS)',
    path: '/tools/email-auth',
    component: React.lazy(() => import('./remote/EmailAuthTool')),
    description: 'SPF, DKIM, DMARC validation',
  },
  {
    id: 'hibp',
    name: 'Password Breach',
    kind: 'remote',
    group: 'Remote (AWS)',
    path: '/tools/hibp',
    component: React.lazy(() => import('./remote/HibpTool')),
    description: 'Check passwords against HIBP database',
  },
  {
    id: 'abuseipdb',
    name: 'IP Reputation',
    kind: 'remote',
    group: 'Remote (AWS)',
    path: '/tools/abuseipdb',
    component: React.lazy(() => import('./remote/AbuseIpDbTool')),
    description: 'AbuseIPDB IP reputation and threat score',
  },
]

