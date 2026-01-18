/**
 * ==============================================================================
 * NETKNIFE - SNMP COMMAND BUILDER TOOL
 * ==============================================================================
 * 
 * Build SNMP commands for v2c and v3 with common OIDs.
 * 
 * FEATURES:
 * - SNMP v2c command builder
 * - SNMP v3 command builder (with authentication)
 * - Common OID reference
 * - Custom OID support
 * 
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

const COMMON_OIDS = {
  'System': {
    'sysDescr': '1.3.6.1.2.1.1.1.0',
    'sysUpTime': '1.3.6.1.2.1.1.3.0',
    'sysContact': '1.3.6.1.2.1.1.4.0',
    'sysName': '1.3.6.1.2.1.1.5.0',
    'sysLocation': '1.3.6.1.2.1.1.6.0',
  },
  'Interfaces': {
    'ifNumber': '1.3.6.1.2.1.2.1.0',
    'ifDescr': '1.3.6.1.2.1.2.2.1.2',
    'ifType': '1.3.6.1.2.1.2.2.1.3',
    'ifSpeed': '1.3.6.1.2.1.2.2.1.5',
    'ifAdminStatus': '1.3.6.1.2.1.2.2.1.7',
    'ifOperStatus': '1.3.6.1.2.1.2.2.1.8',
    'ifInOctets': '1.3.6.1.2.1.2.2.1.10',
    'ifOutOctets': '1.3.6.1.2.1.2.2.1.16',
  },
  'IP': {
    'ipForwarding': '1.3.6.1.2.1.4.1.0',
    'ipDefaultTTL': '1.3.6.1.2.1.4.2.0',
    'ipInReceives': '1.3.6.1.2.1.4.3.0',
    'ipInDelivers': '1.3.6.1.2.1.4.9.0',
    'ipOutRequests': '1.3.6.1.2.1.4.10.0',
    'ipRoutingTable': '1.3.6.1.2.1.4.21',
  },
  'TCP': {
    'tcpActiveOpens': '1.3.6.1.2.1.6.5.0',
    'tcpPassiveOpens': '1.3.6.1.2.1.6.6.0',
    'tcpCurrEstab': '1.3.6.1.2.1.6.9.0',
    'tcpInSegs': '1.3.6.1.2.1.6.10.0',
    'tcpOutSegs': '1.3.6.1.2.1.6.11.0',
  },
  'UDP': {
    'udpInDatagrams': '1.3.6.1.2.1.7.1.0',
    'udpOutDatagrams': '1.3.6.1.2.1.7.4.0',
    'udpNoPorts': '1.3.6.1.2.1.7.2.0',
  },
}

export default function SnmpTool() {
  const [version, setVersion] = useState<'v2c' | 'v3'>('v2c')
  const [host, setHost] = useState('')
  const [community, setCommunity] = useState('public')
  const [oid, setOid] = useState('')
  const [selectedOid, setSelectedOid] = useState('')
  const [command, setCommand] = useState<'get' | 'walk' | 'getnext'>('get')
  
  // v3 fields
  const [username, setUsername] = useState('')
  const [authProtocol, setAuthProtocol] = useState<'MD5' | 'SHA'>('SHA')
  const [authPassword, setAuthPassword] = useState('')
  const [privProtocol, setPrivProtocol] = useState<'DES' | 'AES'>('AES')
  const [privPassword, setPrivPassword] = useState('')
  const [securityLevel, setSecurityLevel] = useState<'noAuthNoPriv' | 'authNoPriv' | 'authPriv'>('authPriv')

  const [output, setOutput] = useState('')

  function buildCommand() {
    if (!host) {
      setOutput('Error: Host is required')
      return
    }

    const oidToUse = selectedOid || oid
    if (!oidToUse) {
      setOutput('Error: OID is required')
      return
    }

    let cmd = 'snmp'

    if (version === 'v2c') {
      // SNMP v2c
      cmd = `snmp${command} -v2c -c ${community} ${host} ${oidToUse}`
    } else {
      // SNMP v3
      cmd = `snmp${command} -v3`
      
      if (securityLevel === 'noAuthNoPriv') {
        cmd += ` -u ${username} -l noAuthNoPriv`
      } else if (securityLevel === 'authNoPriv') {
        cmd += ` -u ${username} -a ${authProtocol} -A "${authPassword}" -l authNoPriv`
      } else {
        cmd += ` -u ${username} -a ${authProtocol} -A "${authPassword}" -x ${privProtocol} -X "${privPassword}" -l authPriv`
      }
      
      cmd += ` ${host} ${oidToUse}`
    }

    setOutput(cmd)
  }

  function handleOidSelect(oidValue: string) {
    setSelectedOid(oidValue)
    setOid(oidValue)
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            Build SNMP commands locally. No data is sent to any server.
          </span>
        </div>
      </div>

      {/* Version selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setVersion('v2c')}
          className={`px-4 py-2 rounded text-sm transition-colors ${
            version === 'v2c'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          SNMP v2c
        </button>
        <button
          onClick={() => setVersion('v3')}
          className={`px-4 py-2 rounded text-sm transition-colors ${
            version === 'v3'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          SNMP v3
        </button>
      </div>

      {/* Common fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Host <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.1.1"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Command</label>
          <select
            value={command}
            onChange={(e) => setCommand(e.target.value as 'get' | 'walk' | 'getnext')}
            className="input"
          >
            <option value="get">GET</option>
            <option value="walk">WALK</option>
            <option value="getnext">GETNEXT</option>
          </select>
        </div>
      </div>

      {/* v2c fields */}
      {version === 'v2c' && (
        <div>
          <label className="block text-sm font-medium mb-2">Community String</label>
          <input
            type="text"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            placeholder="public"
            className="input"
          />
        </div>
      )}

      {/* v3 fields */}
      {version === 'v3' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Username <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="snmpuser"
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Security Level</label>
            <select
              value={securityLevel}
              onChange={(e) => setSecurityLevel(e.target.value as any)}
              className="input"
            >
              <option value="noAuthNoPriv">noAuthNoPriv</option>
              <option value="authNoPriv">authNoPriv</option>
              <option value="authPriv">authPriv (recommended)</option>
            </select>
          </div>

          {securityLevel !== 'noAuthNoPriv' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Auth Protocol</label>
                  <select
                    value={authProtocol}
                    onChange={(e) => setAuthProtocol(e.target.value as 'MD5' | 'SHA')}
                    className="input"
                  >
                    <option value="MD5">MD5</option>
                    <option value="SHA">SHA (recommended)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Auth Password</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {securityLevel === 'authPriv' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Priv Protocol</label>
                    <select
                      value={privProtocol}
                      onChange={(e) => setPrivProtocol(e.target.value as 'DES' | 'AES')}
                      className="input"
                    >
                      <option value="DES">DES</option>
                      <option value="AES">AES (recommended)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Priv Password</label>
                    <input
                      type="password"
                      value={privPassword}
                      onChange={(e) => setPrivPassword(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* OID selection */}
      <div>
        <label className="block text-sm font-medium mb-2">OID <span className="text-red-400">*</span></label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <input
              type="text"
              value={oid}
              onChange={(e) => {
                setOid(e.target.value)
                setSelectedOid('')
              }}
              placeholder="1.3.6.1.2.1.1.1.0 or select from common OIDs"
              className="input font-mono text-sm"
            />
          </div>
          <div>
            <select
              value={selectedOid}
              onChange={(e) => handleOidSelect(e.target.value)}
              className="input"
            >
              <option value="">Select common OID...</option>
              {Object.entries(COMMON_OIDS).map(([category, oids]) => (
                <optgroup key={category} label={category}>
                  {Object.entries(oids).map(([name, oidValue]) => (
                    <option key={oidValue} value={oidValue}>
                      {name} ({oidValue})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={buildCommand}
        className="btn-primary"
      >
        Generate SNMP Command
      </button>

      {/* Output */}
      {output && (
        <>
          <div className="flex items-center justify-end mb-2">
            <AddToReportButton
              toolId="snmp"
              input={`${version} - ${host} - ${command}`}
              data={{ command: output, version, host, oid: selectedOid || oid }}
              category="Network Intelligence"
            />
          </div>
          <OutputCard
            title="SNMP Command"
            value={output}
            canCopy={true}
          />
        </>
      )}

      {/* Reference */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">Common OIDs Reference</h4>
        <div className="space-y-2 text-xs text-gray-400">
          {Object.entries(COMMON_OIDS).map(([category, oids]) => (
            <div key={category}>
              <div className="font-medium text-gray-300 mb-1">{category}</div>
              <div className="ml-2 space-y-1">
                {Object.entries(oids).map(([name, oidValue]) => (
                  <div key={oidValue} className="font-mono">
                    {name}: {oidValue}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
