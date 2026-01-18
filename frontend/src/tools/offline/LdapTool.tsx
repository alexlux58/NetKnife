/**
 * ==============================================================================
 * NETKNIFE - LDAP QUERY BUILDER TOOL
 * ==============================================================================
 * 
 * Build ldapsearch commands for Active Directory and LDAP queries.
 * 
 * FEATURES:
 * - LDAP search command builder
 * - Active Directory specific queries
 * - Common attribute reference
 * - Filter builder
 * 
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

const COMMON_ATTRIBUTES = {
  'User': ['cn', 'sAMAccountName', 'userPrincipalName', 'mail', 'displayName', 'memberOf'],
  'Group': ['cn', 'distinguishedName', 'member', 'memberOf'],
  'Computer': ['cn', 'dNSHostName', 'operatingSystem', 'operatingSystemVersion'],
  'OU': ['ou', 'distinguishedName', 'description'],
}

const AD_TEMPLATES = {
  'List all users': {
    base: 'DC=example,DC=com',
    filter: '(objectClass=user)',
    attributes: 'cn,sAMAccountName,mail',
  },
  'Find user by name': {
    base: 'DC=example,DC=com',
    filter: '(cn=*John*)',
    attributes: 'cn,sAMAccountName,mail,memberOf',
  },
  'List domain admins': {
    base: 'DC=example,DC=com',
    filter: '(memberOf=CN=Domain Admins,CN=Users,DC=example,DC=com)',
    attributes: 'cn,sAMAccountName',
  },
  'List all groups': {
    base: 'DC=example,DC=com',
    filter: '(objectClass=group)',
    attributes: 'cn,distinguishedName,member',
  },
  'Find computers': {
    base: 'DC=example,DC=com',
    filter: '(objectClass=computer)',
    attributes: 'cn,dNSHostName,operatingSystem',
  },
}

export default function LdapTool() {
  const [host, setHost] = useState('')
  const [port, setPort] = useState('389')
  const [useTLS, setUseTLS] = useState(false)
  const [bindDN, setBindDN] = useState('')
  const [bindPassword, setBindPassword] = useState('')
  const [baseDN, setBaseDN] = useState('DC=example,DC=com')
  const [filter, setFilter] = useState('(objectClass=*)')
  const [attributes, setAttributes] = useState('*')
  const [scope, setScope] = useState<'base' | 'one' | 'sub'>('sub')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [output, setOutput] = useState('')

  function buildCommand() {
    if (!host) {
      setOutput('Error: Host is required')
      return
    }

    let cmd = 'ldapsearch'

    // Connection options
    if (useTLS) {
      cmd += ' -x -H ldaps://' + host
      if (port !== '636') {
        cmd += ':' + port
      }
    } else {
      cmd += ' -x -H ldap://' + host
      if (port !== '389') {
        cmd += ':' + port
      }
    }

    // Authentication
    if (bindDN) {
      cmd += ` -D "${bindDN}"`
      if (bindPassword) {
        cmd += ` -w "${bindPassword}"`
      } else {
        cmd += ' -W' // prompt for password
      }
    } else {
      cmd += ' -x' // anonymous bind
    }

    // Search parameters
    cmd += ` -b "${baseDN}"`
    cmd += ` -s ${scope}`
    cmd += ` "${filter}"`
    
    if (attributes && attributes !== '*') {
      cmd += ' ' + attributes.split(',').map(a => a.trim()).join(' ')
    }

    setOutput(cmd)
  }

  function applyTemplate(templateName: string) {
    const template = AD_TEMPLATES[templateName as keyof typeof AD_TEMPLATES]
    if (template) {
      setBaseDN(template.base)
      setFilter(template.filter)
      setAttributes(template.attributes)
      setSelectedTemplate(templateName)
    }
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            Build LDAP commands locally. No data is sent to any server.
          </span>
        </div>
      </div>

      {/* AD Templates */}
      <div>
        <label className="block text-sm font-medium mb-2">Active Directory Templates</label>
        <select
          value={selectedTemplate}
          onChange={(e) => {
            if (e.target.value) {
              applyTemplate(e.target.value)
            }
          }}
          className="input"
        >
          <option value="">Select template...</option>
          {Object.keys(AD_TEMPLATES).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Connection settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Host <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="ldap.example.com"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="useTLS"
          checked={useTLS}
          onChange={(e) => {
            setUseTLS(e.target.checked)
            if (e.target.checked && port === '389') {
              setPort('636')
            } else if (!e.target.checked && port === '636') {
              setPort('389')
            }
          }}
          className="w-4 h-4"
        />
        <label htmlFor="useTLS" className="text-sm">Use TLS (ldaps://)</label>
      </div>

      {/* Authentication */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-2">Bind DN (optional, for authenticated queries)</label>
          <input
            type="text"
            value={bindDN}
            onChange={(e) => setBindDN(e.target.value)}
            placeholder="CN=admin,DC=example,DC=com"
            className="input font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Bind Password (leave empty to prompt)</label>
          <input
            type="password"
            value={bindPassword}
            onChange={(e) => setBindPassword(e.target.value)}
            placeholder="Password (or leave empty to use -W flag)"
            className="input"
          />
        </div>
      </div>

      {/* Search parameters */}
      <div>
        <label className="block text-sm font-medium mb-2">Base DN <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={baseDN}
          onChange={(e) => setBaseDN(e.target.value)}
          placeholder="DC=example,DC=com"
          className="input font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Search Scope</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as any)}
          className="input"
        >
          <option value="base">base (only base DN)</option>
          <option value="one">one (one level)</option>
          <option value="sub">sub (subtree, default)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Filter <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="(objectClass=user)"
          className="input font-mono text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">
          Examples: (objectClass=user), (cn=*John*), (&(objectClass=user)(mail=*@example.com))
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Attributes (comma-separated, or * for all)</label>
        <input
          type="text"
          value={attributes}
          onChange={(e) => setAttributes(e.target.value)}
          placeholder="cn,mail,sAMAccountName"
          className="input font-mono text-sm"
        />
      </div>

      {/* Generate button */}
      <button
        onClick={buildCommand}
        className="btn-primary"
      >
        Generate LDAP Command
      </button>

      {/* Output */}
      {output && (
        <>
          <div className="flex items-center justify-end mb-2">
            <AddToReportButton
              toolId="ldap"
              input={`${host}:${port} - ${filter}`}
              data={{ command: output, host, port, baseDN, filter, scope }}
              category="Network Intelligence"
            />
          </div>
          <OutputCard
            title="LDAP Command"
            value={output}
            canCopy={true}
          />
        </>
      )}

      {/* Reference */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">Common LDAP Attributes</h4>
        <div className="space-y-2 text-xs text-gray-400">
          {Object.entries(COMMON_ATTRIBUTES).map(([category, attrs]) => (
            <div key={category}>
              <div className="font-medium text-gray-300 mb-1">{category}</div>
              <div className="ml-2 font-mono">{attrs.join(', ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
