import { formatDate, relativeTime, type QuienDomainResult, type QuienIpResult, type QuienResult } from './quienLogic'
import type { DnsResult, EmailAuthResult, HeadersResult, QuienBundle, QuienTab, TlsApiResponse } from './quienFetch'

function QuienRow({ label, value, mono = false, link = false }: {
  label: string
  value: string | null | undefined
  mono?: boolean
  link?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
      {label && <span className="text-gray-500 text-sm w-28 shrink-0">{label}</span>}
      {link ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm break-all">
          {value}
        </a>
      ) : (
        <span className={`text-white text-sm ${mono ? 'font-mono text-blue-300' : ''}`}>{value}</span>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-amber-400 font-semibold text-sm">{title}</h4>
        <div className="flex-1 h-px bg-gray-700" />
      </div>
      {children}
    </div>
  )
}

function DateRow({ label, iso }: { label: string; iso: string | null }) {
  if (!iso) return null
  const rel = relativeTime(iso)
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
      <span className="text-gray-500 text-sm w-28 shrink-0">{label}</span>
      <span className="text-white text-sm">{formatDate(iso)}</span>
      {rel && <span className="text-gray-500 text-xs italic">{rel}</span>}
    </div>
  )
}

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-[#0d1117] p-5 shadow-lg">
      <h3 className="text-xl font-bold text-cyan-400 tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  )
}

function TabError({ message }: { message: string }) {
  return <p className="text-red-400 text-sm">{message}</p>
}

function WhoisPanel({ result }: { result: QuienResult }) {
  if (result.kind === 'domain') {
    const data = result as QuienDomainResult
    return (
      <PanelShell title={data.domainName}>
        <QuienRow label="Registrar" value={data.registrar} />
        {data.status.length > 0 && <QuienRow label="Status" value={data.status.join(', ')} />}
        <Section title="Dates">
          <DateRow label="Created" iso={data.createdDate} />
          <DateRow label="Updated" iso={data.updatedDate} />
          <DateRow label="Expires" iso={data.expiryDate} />
        </Section>
        {data.nameservers.length > 0 && (
          <Section title="Nameservers">
            {data.nameservers.map((ns) => <QuienRow key={ns} label="" value={ns.toLowerCase()} mono />)}
          </Section>
        )}
        {data.dnssec != null && <QuienRow label="DNSSEC" value={data.dnssec ? 'signed' : 'unsigned'} />}
      </PanelShell>
    )
  }

  const data = result as QuienIpResult
  return (
    <PanelShell title={data.query}>
      <QuienRow label="Hostname" value={data.hostname} mono link />
      <QuienRow label="Network" value={data.network} mono />
      <QuienRow label="Name" value={data.name} />
      <QuienRow label="Type" value={data.type} />
      <QuienRow label="Org" value={data.org} />
      <QuienRow label="Abuse" value={data.abuse} />
      {(data.startAddr || data.endAddr) && (
        <Section title="Range">
          <QuienRow label="Start" value={data.startAddr} mono />
          <QuienRow label="End" value={data.endAddr} mono />
          <QuienRow label="Handle" value={data.handle} mono />
        </Section>
      )}
    </PanelShell>
  )
}

function DnsPanel({ dns, error }: { dns: QuienBundle['dns']; error?: string }) {
  if (error) return <TabError message={error} />
  const types = Object.keys(dns)
  if (types.length === 0) return <p className="text-gray-500 text-sm">No DNS records found.</p>

  return (
    <div className="space-y-4">
      {types.map((type) => {
        const res = dns[type]
        if (!res?.answer?.length) return null
        return (
          <Section key={type} title={type}>
            {res.answer.map((r, i) => (
              <QuienRow key={`${type}-${i}`} label="" value={r.data.replace(/\.$/, '')} mono />
            ))}
          </Section>
        )
      })}
    </div>
  )
}

function MailPanel({ mail, error }: { mail: EmailAuthResult | null; error?: string }) {
  if (error) return <TabError message={error} />
  if (!mail) return null
  return (
    <PanelShell title={mail.domain}>
      <QuienRow label="Grade" value={`${mail.grade} (${mail.score}/100)`} />
      <Section title="SPF">
        <QuienRow label="Found" value={mail.spf.found ? 'yes' : 'no'} />
        {mail.spf.record && <QuienRow label="Record" value={mail.spf.record} mono />}
        {mail.spf.all && <QuienRow label="All" value={mail.spf.all} mono />}
      </Section>
      <Section title="DMARC">
        <QuienRow label="Found" value={mail.dmarc.found ? 'yes' : 'no'} />
        {mail.dmarc.record && <QuienRow label="Record" value={mail.dmarc.record} mono />}
        {mail.dmarc.policy && <QuienRow label="Policy" value={mail.dmarc.policy} />}
      </Section>
      <Section title="DKIM">
        <QuienRow label="Selector" value={mail.dkim.selector} mono />
        <QuienRow label="Found" value={mail.dkim.found ? 'yes' : 'no'} />
        {mail.dkim.record && <QuienRow label="Record" value={`${mail.dkim.record.slice(0, 80)}…`} mono />}
      </Section>
    </PanelShell>
  )
}

function TlsPanel({ tls, error }: { tls: TlsApiResponse | null; error?: string }) {
  if (error) return <TabError message={error} />
  if (!tls) return null
  const cert = tls.chain?.[0]
  return (
    <PanelShell title={tls.host}>
      {cert && (
        <>
          <QuienRow label="Subject" value={cert.subject} mono />
          <QuienRow label="Issuer" value={cert.issuer} />
          <QuienRow label="Valid from" value={cert.valid_from ? formatDate(cert.valid_from) : null} />
          <QuienRow label="Valid to" value={cert.valid_to ? formatDate(cert.valid_to) : null} />
          {tls.days_remaining != null && (
            <QuienRow label="Days left" value={String(tls.days_remaining)} />
          )}
          {cert.signature_algorithm && <QuienRow label="Signature" value={cert.signature_algorithm} mono />}
          {cert.san && cert.san.length > 0 && (
            <Section title="SANs">
              {cert.san.map((s) => <QuienRow key={s} label="" value={s} mono />)}
            </Section>
          )}
        </>
      )}
      {tls.protocol && <QuienRow label="Protocol" value={tls.protocol} />}
      {tls.cipher && <QuienRow label="Cipher" value={tls.cipher} mono />}
    </PanelShell>
  )
}

function HttpPanel({ http, error }: { http: HeadersResult | null; error?: string }) {
  if (error) return <TabError message={error} />
  if (!http) return null
  const final = http.chain[http.chain.length - 1]
  return (
    <PanelShell title={http.final_url}>
      <QuienRow label="Status" value={final ? `${final.status}` : '—'} />
      <QuienRow label="Redirects" value={String(http.redirects)} />
      {http.chain.length > 1 && (
        <Section title="Redirect chain">
          {http.chain.map((hop, i) => (
            <QuienRow key={i} label={`${hop.status}`} value={hop.url} mono link />
          ))}
        </Section>
      )}
      {final && (
        <>
          <Section title="Security headers">
            {Object.entries(final.security_headers.present).map(([k, v]) => (
              <QuienRow key={k} label={k} value={v} mono />
            ))}
            {final.security_headers.missing.length > 0 && (
              <QuienRow label="Missing" value={final.security_headers.missing.join(', ')} />
            )}
          </Section>
          <Section title="Response headers">
            {Object.entries(final.headers).slice(0, 12).map(([k, v]) => (
              <QuienRow key={k} label={k} value={v} mono />
            ))}
          </Section>
        </>
      )}
    </PanelShell>
  )
}

function ComingSoonPanel({ feature }: { feature: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-[#0d1117] p-5 text-sm text-gray-400">
      <p className="mb-2">
        <span className="text-amber-400 font-medium">{feature}</span> detection is not available in NetKnife yet.
      </p>
      <p>
        The quien CLI includes {feature.toLowerCase()} analysis locally. NetKnife currently covers WHOIS, DNS, mail auth, TLS, and HTTP via AWS.
      </p>
    </div>
  )
}

export function QuienTabPanel({ tab, bundle }: { tab: QuienTab; bundle: QuienBundle }) {
  switch (tab) {
    case 'whois':
      return bundle.whois
        ? <WhoisPanel result={bundle.whois} />
        : <TabError message={bundle.tabErrors.whois || 'WHOIS lookup failed'} />
    case 'dns':
      return <DnsPanel dns={bundle.dns} error={bundle.tabErrors.dns} />
    case 'mail':
      return <MailPanel mail={bundle.mail} error={bundle.tabErrors.mail} />
    case 'tls':
      return <TlsPanel tls={bundle.tls} error={bundle.tabErrors.tls} />
    case 'http':
      return <HttpPanel http={bundle.http} error={bundle.tabErrors.http} />
    case 'seo':
      return <ComingSoonPanel feature="SEO" />
    case 'stack': {
      const hdrs = bundle.http?.chain.at(-1)?.headers ?? {}
      const server = hdrs.server ?? hdrs.Server
      const powered = hdrs['x-powered-by'] ?? hdrs['X-Powered-By']
      if (server || powered) {
        return (
          <PanelShell title="Stack hints">
            <QuienRow label="Server" value={server} />
            <QuienRow label="Powered by" value={powered} />
            <p className="text-gray-500 text-xs mt-4">
              Full stack detection (CMS, JS libs, hosting) requires the quien CLI locally.
            </p>
          </PanelShell>
        )
      }
      return <ComingSoonPanel feature="Stack" />
    }
    default:
      return null
  }
}
