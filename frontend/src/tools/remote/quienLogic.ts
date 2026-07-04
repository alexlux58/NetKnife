/**
 * Parse RDAP JSON into quien-style registration summaries.
 */

export interface QuienDomainResult {
  kind: 'domain'
  query: string
  domainName: string
  registrar: string | null
  status: string[]
  createdDate: string | null
  updatedDate: string | null
  expiryDate: string | null
  nameservers: string[]
  dnssec: boolean | null
}

export interface QuienIpResult {
  kind: 'ip'
  query: string
  hostname: string | null
  name: string | null
  handle: string | null
  network: string | null
  type: string | null
  org: string | null
  abuse: string | null
  startAddr: string | null
  endAddr: string | null
}

export type QuienResult = QuienDomainResult | QuienIpResult

type RdapEntity = {
  roles?: string[]
  handle?: string
  vcardArray?: unknown
  entities?: RdapEntity[]
}

type RdapData = {
  objectClassName?: string
  ldhName?: string
  status?: string[]
  events?: { eventAction?: string; eventDate?: string }[]
  entities?: RdapEntity[]
  nameservers?: { ldhName?: string }[]
  secureDNS?: { delegationSigned?: boolean }
  name?: string
  handle?: string
  startAddress?: string
  endAddress?: string
  type?: string
  cidr0_cidrs?: { v4prefix?: string; v6prefix?: string; length?: number }[]
}

function vcardField(entity: RdapEntity | undefined, field: string): string | null {
  const arr = entity?.vcardArray
  if (!Array.isArray(arr) || arr[0] !== 'vcard' || !Array.isArray(arr[1])) return null
  for (const row of arr[1]) {
    if (Array.isArray(row) && row[0] === field && row[3] != null) {
      const val = String(row[3]).trim()
      return val || null
    }
  }
  return null
}

function entityByRole(entities: RdapEntity[] | undefined, role: string): RdapEntity | undefined {
  if (!entities) return undefined
  for (const e of entities) {
    if (e.roles?.includes(role)) return e
    const nested = entityByRole(e.entities, role)
    if (nested) return nested
  }
  return undefined
}

function eventDate(events: RdapData['events'], action: string): string | null {
  const ev = events?.find((e) => e.eventAction === action)
  return ev?.eventDate ?? null
}

function networkCidr(data: RdapData): string | null {
  const cidr = data.cidr0_cidrs?.[0]
  if (!cidr) {
    if (data.startAddress && data.endAddress) return `${data.startAddress}–${data.endAddress}`
    return null
  }
  const prefix = cidr.v4prefix ?? cidr.v6prefix
  if (prefix && cidr.length != null) return `${prefix}/${cidr.length}`
  return prefix ?? null
}

export function isDomainQuery(query: string): boolean {
  const q = query.trim()
  if (!q || q.includes(':')) return false
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(q)) return false
  return q.includes('.') && !q.startsWith('.')
}

export function parseRdapToQuien(query: string, data: RdapData): QuienResult | null {
  if (!data || typeof data !== 'object') return null

  if (data.objectClassName === 'domain' || data.ldhName?.includes('.')) {
    const registrar = entityByRole(data.entities, 'registrar')
    return {
      kind: 'domain',
      query: query.trim(),
      domainName: (data.ldhName || query).toUpperCase(),
      registrar: vcardField(registrar, 'fn'),
      status: data.status ?? [],
      createdDate: eventDate(data.events, 'registration'),
      updatedDate: eventDate(data.events, 'last changed') ?? eventDate(data.events, 'last update of RDAP database'),
      expiryDate: eventDate(data.events, 'expiration'),
      nameservers: (data.nameservers ?? []).map((ns) => ns.ldhName).filter(Boolean) as string[],
      dnssec: data.secureDNS?.delegationSigned ?? null,
    }
  }

  if (data.startAddress || data.objectClassName === 'ip network') {
    const registrant = entityByRole(data.entities, 'registrant') ?? entityByRole(data.entities, 'technical')
    const abuse = entityByRole(data.entities, 'abuse')
    return {
      kind: 'ip',
      query: query.trim(),
      hostname: null,
      name: data.name ?? null,
      handle: data.handle ?? null,
      network: networkCidr(data),
      type: data.type ?? null,
      org: vcardField(registrant, 'fn') ?? vcardField(registrant, 'org'),
      abuse: vcardField(abuse, 'email'),
      startAddr: data.startAddress ?? null,
      endAddr: data.endAddress ?? null,
    }
  }

  return null
}

export function relativeTime(iso: string | null): string | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null

  const now = new Date()
  const future = then.getTime() > now.getTime()
  const diffMs = Math.abs(then.getTime() - now.getTime())
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  let text: string
  if (days < 1) text = 'today'
  else if (days === 1) text = '1 day'
  else if (days < 30) text = `${days} days`
  else if (days < 365) {
    const months = Math.floor(days / 30)
    text = months === 1 ? '1 month' : `${months} months`
  } else {
    const years = Math.floor(days / 365)
    const months = Math.floor((days % 365) / 30)
    if (months > 0) text = `${years} year${years === 1 ? '' : 's'}, ${months} month${months === 1 ? '' : 's'}`
    else text = years === 1 ? '1 year' : `${years} years`
  }

  return future ? `${text} from now` : `${text} ago`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toISOString().slice(0, 10)
}
