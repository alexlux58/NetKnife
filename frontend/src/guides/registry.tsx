import React from 'react'

export type GuideCategory = 'offensive' | 'defensive' | 'compliance' | 'incident-response'
export type GuideStatus = 'draft' | 'published' | 'archived'

export interface ExternalTool {
  name: string
  url: string
  description: string
}

export interface ToolIntegration {
  toolId: string
  purpose: string
  defaultInput?: any
  required: boolean
  tips: string[]
  externalTools?: ExternalTool[]
}

export interface Tactic {
  id: string
  name: string
  description: string
  attckTechnique?: string
  attckUrl?: string // Full URL to ATT&CK technique page
  examples: string[]
}

export interface DetectionMethod {
  name: string
  description: string
  logSources: string[]
  queries: string[]
  tools: string[]
}

export interface DefenseStrategy {
  name: string
  description: string
  d3fendMitigation?: string
  d3fendUrl?: string // Full URL to D3FEND technique page
  implementation: string[]
  tools: string[]
}

export interface GuideStep {
  id: string
  title: string
  order: number
  overview: string
  objectives: string[]
  prerequisites: string[]
  tools: ToolIntegration[]
  tactics: Tactic[]
  detection: DetectionMethod[]
  defense: DefenseStrategy[]
  examples: string[]
  exercises: string[]
  resources: Array<{ label: string; url: string }>
  attckTechniques: string[]
  d3fendMitigations: string[]
  estimatedTime: string
  component: React.LazyExoticComponent<() => JSX.Element>
}

export interface Guide {
  id: string
  name: string
  category: GuideCategory
  icon: string
  description: string
  status: GuideStatus
  steps: GuideStep[]
  frameworks: string[]
  version: string
  lastUpdated: string
}

const PlaceholderStep = React.lazy(() => import('./steps/PlaceholderStep'))

export const GUIDE_REGISTRY: Record<string, Guide> = {
  'kill-chain': {
    id: 'kill-chain',
    name: 'Cyber Kill Chain',
    category: 'offensive',
    icon: 'Target',
    description: 'Interactive offensive security guide following the Cyber Kill Chain',
    status: 'published',
    frameworks: ['Cyber Kill Chain', 'MITRE ATT&CK', 'MITRE D3FEND'],
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    steps: [
      {
        id: 'reconnaissance',
        title: 'Reconnaissance',
        order: 1,
        overview: 'Gather information about the target: domains, DNS, exposed services, and public footprint.',
        objectives: [
          'Identify public DNS records and infrastructure',
          'Enumerate exposed services and basic posture',
          'Capture initial findings with evidence',
        ],
        prerequisites: ['Authorization to assess target', 'Target scope defined'],
        tools: [
          {
            toolId: 'dns',
            purpose: 'Query DNS records and validate expected DNS hygiene',
            required: true,
            defaultInput: { name: 'example.com', type: 'A' },
            tips: ['Check A/AAAA/CNAME/MX/NS/TXT', 'Look for unexpected endpoints and stale records'],
          },
          {
            toolId: 'ssl-labs',
            purpose: 'Assess public TLS configuration and common weaknesses',
            required: false,
            tips: ['Note grade and deprecated protocols', 'Capture certificate validity and issuer'],
          },
        ],
        tactics: [
          {
            id: 'osint',
            name: 'OSINT Collection',
            description: 'Collect publicly available information about org, domains, and infra.',
            attckTechnique: 'T1595',
            attckUrl: 'https://attack.mitre.org/techniques/T1595/',
            examples: ['Search exposed services', 'Enumerate DNS records and hostnames'],
          },
          {
            id: 'scan-ip',
            name: 'Scan IP Blocks',
            description: 'Scan IP ranges to identify active hosts and services.',
            attckTechnique: 'T1592',
            attckUrl: 'https://attack.mitre.org/techniques/T1592/',
            examples: ['Port scanning', 'Service enumeration', 'Banner grabbing'],
          },
          {
            id: 'gather-victim-info',
            name: 'Gather Victim Identity Information',
            description: 'Collect information about employees, roles, and organizational structure.',
            attckTechnique: 'T1589',
            attckUrl: 'https://attack.mitre.org/techniques/T1589/',
            examples: ['LinkedIn research', 'Email enumeration', 'Social media analysis'],
          },
        ],
        detection: [
          {
            name: 'Recon Detection',
            description: 'Monitor for unusual DNS queries and scanning against public services.',
            logSources: ['DNS logs', 'WAF logs', 'Web server access logs'],
            queries: ['index=proxy action=dns_query | stats count by query', 'index=waf (uri=* or user_agent=*)'],
            tools: ['SIEM', 'WAF', 'EDR'],
          },
        ],
        defense: [
          {
            name: 'Reduce External Exposure',
            description: 'Remove stale records, close unused ports, and enforce modern TLS.',
            d3fendMitigation: 'D3-DNS',
            d3fendUrl: 'https://d3fend.mitre.org/technique/d3f:DNS',
            implementation: ['Inventory DNS', 'Enable HSTS', 'Disable TLS 1.0/1.1'],
            tools: ['TLS Inspector', 'SSL Labs', 'HTTP Headers'],
          },
          {
            name: 'OSINT Protection',
            description: 'Limit publicly available information that attackers can use for reconnaissance.',
            d3fendMitigation: 'D3-OSINT',
            d3fendUrl: 'https://d3fend.mitre.org/technique/d3f:OSINT',
            implementation: ['Review public DNS records', 'Remove unnecessary subdomains', 'Limit public WHOIS data'],
            tools: ['RDAP', 'DNS Lookup'],
          },
        ],
        examples: ['Example: identify subdomain pointing to legacy host', 'Example: SSL Labs reports deprecated TLS versions'],
        exercises: ['Run DNS Lookup for your domain and document records', 'Run SSL Labs and list findings'],
        resources: [
          { label: 'MITRE ATT&CK T1595', url: 'https://attack.mitre.org/techniques/T1595/' },
          { label: 'MITRE D3FEND', url: 'https://d3fend.mitre.org/' },
        ],
        attckTechniques: ['T1595', 'T1592', 'T1589'],
        d3fendMitigations: ['D3-DNS', 'D3-OSINT'],
        estimatedTime: '30-60 minutes',
        component: PlaceholderStep,
      },
    ],
  },
  'blue-team-nist': {
    id: 'blue-team-nist',
    name: 'NIST Cybersecurity Framework',
    category: 'defensive',
    icon: 'Shield',
    description: 'Step-by-step implementation guide for NIST CSF',
    status: 'published',
    frameworks: ['NIST CSF', 'MITRE D3FEND'],
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    steps: [
      {
        id: 'identify',
        title: 'Identify',
        order: 1,
        overview: 'Build asset inventory, risk understanding, and governance foundations.',
        objectives: ['Asset inventory', 'Risk register basics', 'Logging baseline'],
        prerequisites: ['Org scope defined'],
        tools: [
          {
            toolId: 'rdap',
            purpose: 'Validate domain ownership and registration information',
            required: false,
            tips: ['Confirm registrant/expiry data via RDAP where available'],
          },
        ],
        tactics: [],
        detection: [],
        defense: [],
        examples: ['Example: map critical domains and external dependencies'],
        exercises: ['List your critical assets and owners'],
        resources: [{ label: 'NIST CSF', url: 'https://www.nist.gov/cyberframework' }],
        attckTechniques: [],
        d3fendMitigations: [],
        estimatedTime: '1-2 hours',
        component: PlaceholderStep,
      },
    ],
  },
}

export function listGuides(): Guide[] {
  return Object.values(GUIDE_REGISTRY).filter((g) => g.status === 'published')
}

