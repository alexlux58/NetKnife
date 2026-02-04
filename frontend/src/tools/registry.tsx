/**
 * ==============================================================================
 * NETKNIFE - TOOL REGISTRY
 * ==============================================================================
 * 
 * Central registry for all NetKnife tools, organized by functional category.
 * 
 * CATEGORIES:
 * - Network Calculators: IP/subnet math and conversions
 * - DNS & Domain: DNS resolution and domain info
 * - Certificates & TLS: SSL/TLS inspection and certificate parsing
 * - Network Intelligence: BGP, ASN, peering information
 * - Threat Intelligence: IP reputation, malware, breach checks
 * - Email Security: SPF, DKIM, DMARC validation
 * - Encoding & Crypto: Encoding, hashing, tokens
 * - Reference & Templates: Command libraries, port lookups
 * - Time & Scheduling: Timestamps, cron expressions
 * - Data & Text: Format conversion, diffing, regex
 * - Generators: Password, QR code, UUID generation
 * 
 * TOOL KINDS:
 * - offline: Runs entirely in browser (no data leaves)
 * - remote: Calls AWS Lambda (data sent to backend)
 * 
 * ==============================================================================
 */

import React from 'react'

export type ToolKind = 'offline' | 'remote'

/**
 * Tool categories for organized navigation
 */
export type ToolCategory = 
  | 'Network Calculators'
  | 'DNS & Domain'
  | 'Certificates & TLS'
  | 'Network Intelligence'
  | 'Threat Intelligence'
  | 'Email Security'
  | 'Encoding & Crypto'
  | 'Reference & Templates'
  | 'Time & Scheduling'
  | 'Data & Text'
  | 'Generators'
  | 'Utilities'

export interface Tool {
  id: string
  name: string
  kind: ToolKind
  category: ToolCategory
  path: string
  component: React.LazyExoticComponent<() => JSX.Element>
  description?: string
  /** Icon name from @radix-ui/react-icons (optional) */
  icon?: string
  /** If true, requires API key to be configured */
  requiresApiKey?: boolean
}

/**
 * Category metadata for display
 */
export const categoryInfo: Record<ToolCategory, { icon: string; description: string }> = {
  'Network Calculators': { 
    icon: 'Calculator', 
    description: 'IP addressing, subnets, and network math' 
  },
  'DNS & Domain': { 
    icon: 'Globe', 
    description: 'DNS resolution and domain information' 
  },
  'Certificates & TLS': { 
    icon: 'Lock', 
    description: 'SSL/TLS certificates and encryption' 
  },
  'Network Intelligence': { 
    icon: 'Network', 
    description: 'BGP, ASN, peering, and routing' 
  },
  'Threat Intelligence': { 
    icon: 'Shield', 
    description: 'IP reputation, malware, and security' 
  },
  'Email Security': { 
    icon: 'Mail', 
    description: 'Email authentication and security' 
  },
  'Encoding & Crypto': { 
    icon: 'Code', 
    description: 'Encoding, hashing, and tokens' 
  },
  'Reference & Templates': { 
    icon: 'Book', 
    description: 'Command libraries and references' 
  },
  'Time & Scheduling': { 
    icon: 'Clock', 
    description: 'Time conversion and scheduling' 
  },
  'Data & Text': { 
    icon: 'FileText', 
    description: 'Format conversion and text tools' 
  },
  'Generators': { 
    icon: 'Wand', 
    description: 'Generate passwords, codes, and IDs' 
  },
  'Utilities': { 
    icon: 'Gear', 
    description: 'Report building and utility tools' 
  },
}

/**
 * All registered tools organized by category
 */
export const tools: Tool[] = [
  // ============================================================================
  // NETWORK CALCULATORS (Offline)
  // ============================================================================
  {
    id: 'subnet',
    name: 'Subnet / CIDR',
    kind: 'offline',
    category: 'Network Calculators',
    path: '/tools/subnet',
    component: React.lazy(() => import('./offline/SubnetTool')),
    description: 'IPv4/IPv6 subnet calculator with AWS info',
  },
  {
    id: 'cidr-range',
    name: 'CIDR Range Checker',
    kind: 'offline',
    category: 'Network Calculators',
    path: '/tools/cidr-range',
    component: React.lazy(() => import('./offline/CidrRangeTool')),
    description: 'Check if IP falls within a CIDR range',
  },
  {
    id: 'ip-converter',
    name: 'IP Converter',
    kind: 'offline',
    category: 'Network Calculators',
    path: '/tools/ip-converter',
    component: React.lazy(() => import('./offline/IpConverterTool')),
    description: 'Convert between decimal, binary, hex, IPv4/IPv6',
  },
  {
    id: 'ipv6-analyzer',
    name: 'IPv6 Analyzer',
    kind: 'offline',
    category: 'Network Calculators',
    path: '/tools/ipv6-analyzer',
    component: React.lazy(() => import('./offline/Ipv6AnalyzerTool')),
    description: 'Analyze IPv6 address type, scope, and format',
  },

  // ============================================================================
  // DNS & DOMAIN (Remote)
  // ============================================================================
  {
    id: 'dns',
    name: 'DNS Lookup',
    kind: 'remote',
    category: 'DNS & Domain',
    path: '/tools/dns',
    component: React.lazy(() => import('./remote/DnsTool')),
    description: 'DNS-over-HTTPS via Cloudflare',
  },
  {
    id: 'reverse-dns',
    name: 'Reverse DNS (PTR)',
    kind: 'remote',
    category: 'DNS & Domain',
    path: '/tools/reverse-dns',
    component: React.lazy(() => import('./remote/ReverseDnsTool')),
    description: 'PTR record lookup for IPs',
  },
  {
    id: 'rdap',
    name: 'RDAP / WHOIS',
    kind: 'remote',
    category: 'DNS & Domain',
    path: '/tools/rdap',
    component: React.lazy(() => import('./remote/RdapTool')),
    description: 'Domain and IP registration data',
  },
  {
    id: 'dns-propagation',
    name: 'DNS Propagation',
    kind: 'remote',
    category: 'DNS & Domain',
    path: '/tools/dns-propagation',
    component: React.lazy(() => import('./remote/DnsPropagationTool')),
    description: 'Check DNS across global resolvers',
  },

  // ============================================================================
  // CERTIFICATES & TLS (Mixed)
  // ============================================================================
  {
    id: 'tls',
    name: 'TLS Inspector',
    kind: 'remote',
    category: 'Certificates & TLS',
    path: '/tools/tls',
    component: React.lazy(() => import('./remote/TlsTool')),
    description: 'Certificate chain and expiry checker',
  },
  {
    id: 'pem-decoder',
    name: 'PEM Decoder',
    kind: 'offline',
    category: 'Certificates & TLS',
    path: '/tools/pem-decoder',
    component: React.lazy(() => import('./offline/PemDecoderTool')),
    description: 'Parse X.509 certificates locally',
  },
  {
    id: 'ssl-labs',
    name: 'SSL Labs',
    kind: 'remote',
    category: 'Certificates & TLS',
    path: '/tools/ssl-labs',
    component: React.lazy(() => import('./remote/SslLabsTool')),
    description: 'Qualys SSL Labs grade checker',
  },

  // ============================================================================
  // NETWORK INTELLIGENCE (Remote)
  // ============================================================================
  {
    id: 'peeringdb',
    name: 'PeeringDB',
    kind: 'remote',
    category: 'Network Intelligence',
    path: '/tools/peeringdb',
    component: React.lazy(() => import('./remote/PeeringDbTool')),
    description: 'Network and IX information',
  },
  {
    id: 'bgp-looking-glass',
    name: 'BGP Looking Glass',
    kind: 'remote',
    category: 'Network Intelligence',
    path: '/tools/bgp-looking-glass',
    component: React.lazy(() => import('./remote/BgpLookingGlassTool')),
    description: 'Query BGP route servers',
  },
  {
    id: 'asn-details',
    name: 'ASN Details',
    kind: 'remote',
    category: 'Network Intelligence',
    path: '/tools/asn-details',
    component: React.lazy(() => import('./remote/AsnDetailsTool')),
    description: 'Autonomous System information',
  },
  {
    id: 'traceroute',
    name: 'Traceroute',
    kind: 'remote',
    category: 'Network Intelligence',
    path: '/tools/traceroute',
    component: React.lazy(() => import('./remote/TracerouteTool')),
    description: 'Trace route from AWS vantage point',
  },
  {
    id: 'cloudflare-speedtest',
    name: 'Cloudflare Speed Test',
    kind: 'offline',
    category: 'Network Intelligence',
    path: '/tools/cloudflare-speedtest',
    component: React.lazy(() => import('./offline/CloudflareSpeedTestTool')),
    description: 'Download, upload, latency, jitter; add results to reports',
  },

  // ============================================================================
  // THREAT INTELLIGENCE (Remote)
  // ============================================================================
  {
    id: 'abuseipdb',
    name: 'AbuseIPDB',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/abuseipdb',
    component: React.lazy(() => import('./remote/AbuseIpDbTool')),
    description: 'IP reputation and threat score',
  },
  {
    id: 'hibp',
    name: 'Password Breach (HIBP)',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/hibp',
    component: React.lazy(() => import('./remote/HibpTool')),
    description: 'Check passwords against breach database',
  },
  {
    id: 'cvss-explainer',
    name: 'CVSS Explainer',
    kind: 'offline',
    category: 'Threat Intelligence',
    path: '/tools/cvss-explainer',
    component: React.lazy(() => import('./offline/CvssExplainerTool')),
    description: 'Parse CVSS 2.0/3.x vectors, explain metrics, compute base score',
  },
  {
    id: 'cve-lookup',
    name: 'CVE & Exploit Intel',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/cve-lookup',
    component: React.lazy(() => import('./remote/CveLookupTool')),
    description: 'Look up CVEs (NVD, OSV), top 30 by period/category/severity, optional AI',
  },
  {
    id: 'ip-api',
    name: 'IP Geolocation',
    kind: 'remote',
    category: 'Network Intelligence',
    path: '/tools/ip-api',
    component: React.lazy(() => import('./remote/IpApiTool')),
    description: 'IP geolocation and ISP information',
  },
  {
    id: 'ipqualityscore',
    name: 'IP Reputation (IPQS)',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/ipqualityscore',
    component: React.lazy(() => import('./remote/IpQualityScoreTool')),
    description: 'IP fraud score and threat detection',
    requiresApiKey: true,
  },
  {
    id: 'ipqs-phone',
    name: 'Phone Validation (IPQS)',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/ipqs-phone',
    component: React.lazy(() => import('./remote/IpqsPhoneTool')),
    description: 'Phone number validation and risk assessment',
    requiresApiKey: true,
  },
  {
    id: 'ipqs-url',
    name: 'URL Scanner (IPQS)',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/ipqs-url',
    component: React.lazy(() => import('./remote/IpqsUrlTool')),
    description: 'Malicious URL scanner and reputation',
    requiresApiKey: true,
  },
  {
    id: 'phone-validator',
    name: 'Phone Validator',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/phone-validator',
    component: React.lazy(() => import('./remote/PhoneValidatorTool')),
    description: 'Phone number validation and carrier detection',
  },
  {
    id: 'osint-dashboard',
    name: 'OSINT Dashboard',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/osint-dashboard',
    component: React.lazy(() => import('./remote/OsintDashboardTool')),
    description: 'Consolidated threat intelligence from multiple sources',
  },
  {
    id: 'security-advisor',
    name: 'Security Advisor',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/security-advisor',
    component: React.lazy(() => import('./remote/SecurityAdvisorTool')),
    description: 'AI-powered security guidance and tool recommendations',
    requiresApiKey: true,
  },
  {
    id: 'report-builder',
    name: 'Report Builder',
    kind: 'remote',
    category: 'Utilities',
    path: '/tools/report-builder',
    component: React.lazy(() => import('./remote/ReportBuilderTool')),
    description: 'Collect tool results and generate PDF reports',
  },
  {
    id: 'virustotal',
    name: 'VirusTotal',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/virustotal',
    component: React.lazy(() => import('./remote/VirusTotalTool')),
    description: 'File/URL/IP malware analysis',
    requiresApiKey: true,
  },
  {
    id: 'shodan',
    name: 'Shodan',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/shodan',
    component: React.lazy(() => import('./remote/ShodanTool')),
    description: 'Internet-connected device search',
    requiresApiKey: true,
  },
  {
    id: 'greynoise',
    name: 'GreyNoise',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/greynoise',
    component: React.lazy(() => import('./remote/GreyNoiseTool')),
    description: 'Internet scanner and noise detection',
    requiresApiKey: true,
  },
  {
    id: 'censys',
    name: 'Censys',
    kind: 'remote',
    category: 'Threat Intelligence',
    path: '/tools/censys',
    component: React.lazy(() => import('./remote/CensysTool')),
    description: 'Internet asset discovery',
    requiresApiKey: true,
  },

  // ============================================================================
  // EMAIL SECURITY (Remote)
  // ============================================================================
  {
    id: 'email-analysis',
    name: 'Email Analysis',
    kind: 'remote',
    category: 'Email Security',
    path: '/tools/email-analysis',
    component: React.lazy(() => import('./remote/EmailAnalysisTool')),
    description: 'Run one email through reputation, breach, verification, Hunter, and SPF/DKIM/DMARC',
  },
  {
    id: 'email-auth',
    name: 'Email Auth Check',
    kind: 'remote',
    category: 'Email Security',
    path: '/tools/email-auth',
    component: React.lazy(() => import('./remote/EmailAuthTool')),
    description: 'SPF, DKIM, DMARC validation',
  },
  {
    id: 'security-trails',
    name: 'SecurityTrails',
    kind: 'remote',
    category: 'Email Security',
    path: '/tools/security-trails',
    component: React.lazy(() => import('./remote/SecurityTrailsTool')),
    description: 'Domain and DNS history',
    requiresApiKey: true,
  },
  {
    id: 'headers',
    name: 'HTTP Headers',
    kind: 'remote',
    category: 'Email Security',
    path: '/tools/headers',
    component: React.lazy(() => import('./remote/HeadersTool')),
    description: 'Security headers scanner',
  },

  // ============================================================================
  // ENCODING & CRYPTO (Offline)
  // ============================================================================
  {
    id: 'encoder',
    name: 'Encoder/Decoder',
    kind: 'offline',
    category: 'Encoding & Crypto',
    path: '/tools/encoder',
    component: React.lazy(() => import('./offline/EncoderTool')),
    description: 'Base64, Hex, URL, HTML encoding',
  },
  {
    id: 'hash',
    name: 'Hash Generator',
    kind: 'offline',
    category: 'Encoding & Crypto',
    path: '/tools/hash',
    component: React.lazy(() => import('./offline/HashTool')),
    description: 'MD5, SHA-1, SHA-256, SHA-512',
  },
  {
    id: 'jwt',
    name: 'JWT Decoder',
    kind: 'offline',
    category: 'Encoding & Crypto',
    path: '/tools/jwt',
    component: React.lazy(() => import('./offline/JwtDecoderTool')),
    description: 'Decode JSON Web Tokens',
  },
  {
    id: 'uuid',
    name: 'UUID Generator',
    kind: 'offline',
    category: 'Encoding & Crypto',
    path: '/tools/uuid',
    component: React.lazy(() => import('./offline/UuidTool')),
    description: 'Generate UUID v1, v4, v5',
  },

  // ============================================================================
  // REFERENCE & TEMPLATES (Offline)
  // ============================================================================
  {
    id: 'cmdlib',
    name: 'Command Templates',
    kind: 'offline',
    category: 'Reference & Templates',
    path: '/tools/cmdlib',
    component: React.lazy(() => import('./offline/CommandTemplatesTool')),
    description: 'Multi-vendor CLI command library',
  },
  {
    id: 'port-reference',
    name: 'Port Reference',
    kind: 'offline',
    category: 'Reference & Templates',
    path: '/tools/port-reference',
    component: React.lazy(() => import('./offline/PortReferenceTool')),
    description: 'Common ports and services database',
  },
  {
    id: 'mac-vendor',
    name: 'MAC Vendor Lookup',
    kind: 'offline',
    category: 'Reference & Templates',
    path: '/tools/mac-vendor',
    component: React.lazy(() => import('./offline/MacVendorTool')),
    description: 'Identify manufacturer from MAC OUI',
  },

  // ============================================================================
  // TIME & SCHEDULING (Offline)
  // ============================================================================
  {
    id: 'timestamp',
    name: 'Timestamp Converter',
    kind: 'offline',
    category: 'Time & Scheduling',
    path: '/tools/timestamp',
    component: React.lazy(() => import('./offline/TimestampTool')),
    description: 'Unix ↔ human-readable dates',
  },
  {
    id: 'cron-builder',
    name: 'Cron Builder',
    kind: 'offline',
    category: 'Time & Scheduling',
    path: '/tools/cron-builder',
    component: React.lazy(() => import('./offline/CronBuilderTool')),
    description: 'Visual cron expression builder',
  },

  // ============================================================================
  // DATA & TEXT (Offline)
  // ============================================================================
  {
    id: 'yaml-json',
    name: 'YAML ↔ JSON',
    kind: 'offline',
    category: 'Data & Text',
    path: '/tools/yaml-json',
    component: React.lazy(() => import('./offline/YamlJsonTool')),
    description: 'Convert between YAML and JSON',
  },
  {
    id: 'diff',
    name: 'Diff Tool',
    kind: 'offline',
    category: 'Data & Text',
    path: '/tools/diff',
    component: React.lazy(() => import('./offline/DiffTool')),
    description: 'Compare two text blocks',
  },
  {
    id: 'regex',
    name: 'Regex Helper',
    kind: 'offline',
    category: 'Data & Text',
    path: '/tools/regex',
    component: React.lazy(() => import('./offline/RegexTool')),
    description: 'Build and test regex patterns',
  },
  {
    id: 'git-graph',
    name: 'Git Branch Visualizer',
    kind: 'offline',
    category: 'Data & Text',
    path: '/tools/git-graph',
    component: React.lazy(() => import('./offline/GitGraphTool')),
    description: 'Visualize git branches and merges from log output',
  },

  // ============================================================================
  // GENERATORS (Offline)
  // ============================================================================
  {
    id: 'password',
    name: 'Password Generator',
    kind: 'offline',
    category: 'Generators',
    path: '/tools/password',
    component: React.lazy(() => import('./offline/PasswordTool')),
    description: 'Cryptographically secure passwords',
  },
  {
    id: 'qr-code',
    name: 'QR Code Generator',
    kind: 'offline',
    category: 'Generators',
    path: '/tools/qr-code',
    component: React.lazy(() => import('./offline/QrCodeTool')),
    description: 'Generate QR codes for WiFi, URLs',
  },

  // ============================================================================
  // PENTESTING & SECURITY TOOLS (Offline)
  // ============================================================================
  {
    id: 'pgp',
    name: 'PGP Encryption',
    kind: 'offline',
    category: 'Encoding & Crypto',
    path: '/tools/pgp',
    component: React.lazy(() => import('./offline/PgpTool')),
    description: 'Encrypt, decrypt, sign, and verify PGP messages',
  },
  {
    id: 'certificate-generator',
    name: 'Certificate & CSR Generator',
    kind: 'offline',
    category: 'Certificates & TLS',
    path: '/tools/certificate-generator',
    component: React.lazy(() => import('./offline/CertificateGeneratorTool')),
    description: 'Generate CSR and self-signed certificates',
  },
  {
    id: 'snmp',
    name: 'SNMP Command Builder',
    kind: 'offline',
    category: 'Reference & Templates',
    path: '/tools/snmp',
    component: React.lazy(() => import('./offline/SnmpTool')),
    description: 'Build SNMP v2c/v3 commands with common OIDs',
  },
  {
    id: 'ldap',
    name: 'LDAP Query Builder',
    kind: 'offline',
    category: 'Reference & Templates',
    path: '/tools/ldap',
    component: React.lazy(() => import('./offline/LdapTool')),
    description: 'Build ldapsearch commands for AD and LDAP',
  },
  {
    id: 'smtp',
    name: 'SMTP Diagnostics',
    kind: 'offline',
    category: 'Reference & Templates',
    path: '/tools/smtp',
    component: React.lazy(() => import('./offline/SmtpTool')),
    description: 'Build SMTP diagnostic commands',
  },
  {
    id: 'google-dorks',
    name: 'Google Dorks Generator',
    kind: 'offline',
    category: 'Reference & Templates',
    path: '/tools/google-dorks',
    component: React.lazy(() => import('./offline/GoogleDorksTool')),
    description: 'Generate Google search queries for security research',
  },
  {
    id: 'prompt-templates',
    name: 'Prompt Templates',
    kind: 'offline',
    category: 'Reference & Templates',
    path: '/tools/prompt-templates',
    component: React.lazy(() => import('./offline/PromptTemplatesTool')),
    description: 'Security and network engineering prompt templates',
  },
]

/**
 * Get tools grouped by category
 */
export function getToolsByCategory(): Map<ToolCategory, Tool[]> {
  const grouped = new Map<ToolCategory, Tool[]>()
  
  for (const tool of tools) {
    const existing = grouped.get(tool.category) || []
    existing.push(tool)
    grouped.set(tool.category, existing)
  }
  
  return grouped
}

/**
 * Get all categories in display order
 */
export function getCategories(): ToolCategory[] {
  return [
    'Network Calculators',
    'DNS & Domain',
    'Certificates & TLS',
    'Network Intelligence',
    'Threat Intelligence',
    'Email Security',
    'Encoding & Crypto',
    'Reference & Templates',
    'Time & Scheduling',
    'Data & Text',
    'Generators',
    'Utilities',
  ]
}
