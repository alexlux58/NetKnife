import { apiPost } from '../../lib/api'
import { isDomainQuery, parseRdapToQuien, type QuienResult } from './quienLogic'

export type QuienTab = 'whois' | 'dns' | 'mail' | 'tls' | 'http' | 'seo' | 'stack'

export interface DnsRecord {
  name: string
  type: number
  TTL: number
  data: string
}

export interface DnsResult {
  name: string
  type: string
  status: number
  answer: DnsRecord[]
  cached?: boolean
}

export interface EmailAuthResult {
  domain: string
  score: number
  grade: string
  spf: { found: boolean; record?: string; all?: string; warnings?: string[] }
  dmarc: { found: boolean; record?: string; policy?: string; warnings?: string[] }
  dkim: { found: boolean; selector: string; record?: string; warnings?: string[] }
}

export interface TlsApiResponse {
  host: string
  port: number
  protocol?: string
  cipher?: string
  days_remaining?: number
  chain?: {
    subject?: string
    issuer?: string
    valid_from?: string
    valid_to?: string
    san?: string[]
    signature_algorithm?: string
  }[]
}

export interface HeadersResult {
  input: string
  final_url: string
  redirects: number
  chain: {
    url: string
    status: number
    location?: string
    security_headers: { present: Record<string, string>; missing: string[] }
    headers: Record<string, string>
  }[]
}

export interface QuienBundle {
  query: string
  isDomain: boolean
  whois: QuienResult | null
  dns: Partial<Record<string, DnsResult>>
  mail: EmailAuthResult | null
  tls: TlsApiResponse | null
  http: HeadersResult | null
  tabErrors: Partial<Record<QuienTab, string>>
}

const DNS_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'] as const

async function fetchWhois(q: string): Promise<QuienResult> {
  const rdap = await apiPost<{ status?: number; data?: Record<string, unknown> }>('/rdap', { query: q })
  if (rdap.status && rdap.status >= 400) {
    throw new Error(`RDAP returned ${rdap.status}`)
  }
  const parsed = parseRdapToQuien(q, (rdap.data ?? {}) as Parameters<typeof parseRdapToQuien>[1])
  if (!parsed) throw new Error('Could not parse RDAP response')
  if (parsed.kind === 'ip' && !isDomainQuery(q)) {
    try {
      const ptr = await apiPost<{ ptr?: string[] | null }>('/reverse-dns', { ip: q })
      const hostname = ptr.ptr?.[0]?.replace(/\.$/, '')
      if (hostname) parsed.hostname = hostname
    } catch {
      /* optional */
    }
  }
  return parsed
}

export async function fetchQuienBundle(query: string): Promise<QuienBundle> {
  const q = query.trim().toLowerCase()
  const isDomain = isDomainQuery(q)
  const bundle: QuienBundle = {
    query: q,
    isDomain,
    whois: null,
    dns: {},
    mail: null,
    tls: null,
    http: null,
    tabErrors: {},
  }

  try {
    bundle.whois = await fetchWhois(q)
  } catch (e) {
    bundle.tabErrors.whois = e instanceof Error ? e.message : String(e)
  }

  if (!isDomain) return bundle

  const settled = await Promise.allSettled([
    Promise.all(
      DNS_TYPES.map(async (type) => {
        const res = await apiPost<DnsResult>('/dns', { name: q, type })
        return [type, res] as const
      })
    ),
    apiPost<EmailAuthResult>('/email-auth', { domain: q, dkimSelector: 'default' }),
    apiPost<TlsApiResponse>('/tls', { host: q, port: 443 }),
    apiPost<HeadersResult>('/headers', { url: `https://${q}` }),
  ])

  if (settled[0].status === 'fulfilled') {
    for (const [type, res] of settled[0].value) {
      bundle.dns[type] = res
    }
  } else {
    bundle.tabErrors.dns = settled[0].reason instanceof Error ? settled[0].reason.message : String(settled[0].reason)
  }

  if (settled[1].status === 'fulfilled') bundle.mail = settled[1].value
  else bundle.tabErrors.mail = settled[1].reason instanceof Error ? settled[1].reason.message : String(settled[1].reason)

  if (settled[2].status === 'fulfilled') bundle.tls = settled[2].value
  else bundle.tabErrors.tls = settled[2].reason instanceof Error ? settled[2].reason.message : String(settled[2].reason)

  if (settled[3].status === 'fulfilled') bundle.http = settled[3].value
  else bundle.tabErrors.http = settled[3].reason instanceof Error ? settled[3].reason.message : String(settled[3].reason)

  return bundle
}

export const QUIEN_TABS: { id: QuienTab; label: string; shortcut: string; domainOnly?: boolean }[] = [
  { id: 'whois', label: 'WHOIS', shortcut: 'w' },
  { id: 'dns', label: 'DNS', shortcut: 'd', domainOnly: true },
  { id: 'mail', label: 'Mail', shortcut: 'm', domainOnly: true },
  { id: 'tls', label: 'SSL/TLS', shortcut: 's', domainOnly: true },
  { id: 'http', label: 'HTTP', shortcut: 'h', domainOnly: true },
  { id: 'seo', label: 'SEO', shortcut: 'e', domainOnly: true },
  { id: 'stack', label: 'Stack', shortcut: 't', domainOnly: true },
]
