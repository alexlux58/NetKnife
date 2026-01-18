/**
 * ==============================================================================
 * NETKNIFE - PORT REFERENCE TOOL
 * ==============================================================================
 * 
 * Searchable database of common network ports and services.
 * 
 * FEATURES:
 * - Search by port number, service name, or description
 * - Organized by category (Web, Email, Database, etc.)
 * - Shows TCP/UDP protocol
 * - Includes security notes
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import AddToReportButton from '../../components/AddToReportButton'

interface PortEntry {
  port: number | string // Can be range like "6660-6669"
  protocol: 'TCP' | 'UDP' | 'TCP/UDP'
  service: string
  description: string
  category: string
  secure?: boolean
  notes?: string
}

/**
 * Comprehensive port database
 */
const PORT_DATABASE: PortEntry[] = [
  // System/Well-Known
  { port: 20, protocol: 'TCP', service: 'FTP-DATA', description: 'FTP Data Transfer', category: 'File Transfer', notes: 'Passive mode uses ephemeral ports' },
  { port: 21, protocol: 'TCP', service: 'FTP', description: 'FTP Control', category: 'File Transfer', notes: 'Unencrypted, use SFTP instead' },
  { port: 22, protocol: 'TCP', service: 'SSH', description: 'Secure Shell', category: 'Remote Access', secure: true },
  { port: 23, protocol: 'TCP', service: 'Telnet', description: 'Telnet', category: 'Remote Access', notes: 'Unencrypted, use SSH instead' },
  { port: 25, protocol: 'TCP', service: 'SMTP', description: 'Simple Mail Transfer', category: 'Email', notes: 'Often blocked by ISPs' },
  { port: 53, protocol: 'TCP/UDP', service: 'DNS', description: 'Domain Name System', category: 'DNS' },
  { port: 67, protocol: 'UDP', service: 'DHCP', description: 'DHCP Server', category: 'Network Services' },
  { port: 68, protocol: 'UDP', service: 'DHCP', description: 'DHCP Client', category: 'Network Services' },
  { port: 69, protocol: 'UDP', service: 'TFTP', description: 'Trivial FTP', category: 'File Transfer', notes: 'No authentication' },
  { port: 80, protocol: 'TCP', service: 'HTTP', description: 'HyperText Transfer Protocol', category: 'Web' },
  { port: 88, protocol: 'TCP/UDP', service: 'Kerberos', description: 'Kerberos Authentication', category: 'Authentication', secure: true },
  { port: 110, protocol: 'TCP', service: 'POP3', description: 'Post Office Protocol v3', category: 'Email', notes: 'Use POP3S (995) instead' },
  { port: 119, protocol: 'TCP', service: 'NNTP', description: 'Network News Transfer', category: 'Other' },
  { port: 123, protocol: 'UDP', service: 'NTP', description: 'Network Time Protocol', category: 'Network Services' },
  { port: 135, protocol: 'TCP', service: 'RPC', description: 'Microsoft RPC', category: 'Windows', notes: 'Often exploited' },
  { port: 137, protocol: 'UDP', service: 'NetBIOS-NS', description: 'NetBIOS Name Service', category: 'Windows' },
  { port: 138, protocol: 'UDP', service: 'NetBIOS-DGM', description: 'NetBIOS Datagram', category: 'Windows' },
  { port: 139, protocol: 'TCP', service: 'NetBIOS-SSN', description: 'NetBIOS Session', category: 'Windows', notes: 'SMBv1, avoid' },
  { port: 143, protocol: 'TCP', service: 'IMAP', description: 'Internet Message Access Protocol', category: 'Email', notes: 'Use IMAPS (993) instead' },
  { port: 161, protocol: 'UDP', service: 'SNMP', description: 'SNMP Queries', category: 'Network Management' },
  { port: 162, protocol: 'UDP', service: 'SNMPTRAP', description: 'SNMP Traps', category: 'Network Management' },
  { port: 179, protocol: 'TCP', service: 'BGP', description: 'Border Gateway Protocol', category: 'Routing' },
  { port: 194, protocol: 'TCP', service: 'IRC', description: 'Internet Relay Chat', category: 'Messaging' },
  { port: 389, protocol: 'TCP/UDP', service: 'LDAP', description: 'Lightweight Directory Access', category: 'Directory', notes: 'Use LDAPS (636) instead' },
  { port: 443, protocol: 'TCP', service: 'HTTPS', description: 'HTTP Secure', category: 'Web', secure: true },
  { port: 445, protocol: 'TCP', service: 'SMB', description: 'Server Message Block', category: 'File Sharing', notes: 'Common attack target' },
  { port: 464, protocol: 'TCP/UDP', service: 'Kpasswd', description: 'Kerberos Password Change', category: 'Authentication', secure: true },
  { port: 465, protocol: 'TCP', service: 'SMTPS', description: 'SMTP over SSL (deprecated)', category: 'Email', secure: true, notes: 'Use 587 with STARTTLS' },
  { port: 500, protocol: 'UDP', service: 'IKE', description: 'IPsec Key Exchange', category: 'VPN', secure: true },
  { port: 514, protocol: 'UDP', service: 'Syslog', description: 'System Logging', category: 'Logging' },
  { port: 515, protocol: 'TCP', service: 'LPD', description: 'Line Printer Daemon', category: 'Printing' },
  { port: 520, protocol: 'UDP', service: 'RIP', description: 'Routing Information Protocol', category: 'Routing' },
  { port: 530, protocol: 'TCP/UDP', service: 'RPC', description: 'Remote Procedure Call', category: 'RPC' },
  { port: 543, protocol: 'TCP', service: 'Klogin', description: 'Kerberos Login', category: 'Authentication' },
  { port: 544, protocol: 'TCP', service: 'Kshell', description: 'Kerberos Shell', category: 'Authentication' },
  { port: 546, protocol: 'UDP', service: 'DHCPv6', description: 'DHCPv6 Client', category: 'Network Services' },
  { port: 547, protocol: 'UDP', service: 'DHCPv6', description: 'DHCPv6 Server', category: 'Network Services' },
  { port: 554, protocol: 'TCP/UDP', service: 'RTSP', description: 'Real Time Streaming Protocol', category: 'Streaming' },
  { port: 587, protocol: 'TCP', service: 'SMTP', description: 'SMTP Submission', category: 'Email', secure: true, notes: 'Preferred for email submission with STARTTLS' },
  { port: 631, protocol: 'TCP/UDP', service: 'IPP', description: 'Internet Printing Protocol', category: 'Printing' },
  { port: 636, protocol: 'TCP', service: 'LDAPS', description: 'LDAP over SSL', category: 'Directory', secure: true },
  { port: 853, protocol: 'TCP', service: 'DNS-over-TLS', description: 'Encrypted DNS', category: 'DNS', secure: true },
  { port: 873, protocol: 'TCP', service: 'rsync', description: 'Remote Sync', category: 'File Transfer' },
  { port: 989, protocol: 'TCP', service: 'FTPS-DATA', description: 'FTP Data over TLS', category: 'File Transfer', secure: true },
  { port: 990, protocol: 'TCP', service: 'FTPS', description: 'FTP Control over TLS', category: 'File Transfer', secure: true },
  { port: 993, protocol: 'TCP', service: 'IMAPS', description: 'IMAP over SSL', category: 'Email', secure: true },
  { port: 995, protocol: 'TCP', service: 'POP3S', description: 'POP3 over SSL', category: 'Email', secure: true },
  
  // Database
  { port: 1433, protocol: 'TCP', service: 'MSSQL', description: 'Microsoft SQL Server', category: 'Database' },
  { port: 1434, protocol: 'UDP', service: 'MSSQL-Browser', description: 'SQL Server Browser', category: 'Database' },
  { port: 1521, protocol: 'TCP', service: 'Oracle', description: 'Oracle Database', category: 'Database' },
  { port: 3306, protocol: 'TCP', service: 'MySQL', description: 'MySQL/MariaDB', category: 'Database' },
  { port: 5432, protocol: 'TCP', service: 'PostgreSQL', description: 'PostgreSQL Database', category: 'Database' },
  { port: 6379, protocol: 'TCP', service: 'Redis', description: 'Redis Cache/DB', category: 'Database' },
  { port: 27017, protocol: 'TCP', service: 'MongoDB', description: 'MongoDB Database', category: 'Database' },
  { port: 9042, protocol: 'TCP', service: 'Cassandra', description: 'Apache Cassandra', category: 'Database' },
  { port: 9200, protocol: 'TCP', service: 'Elasticsearch', description: 'Elasticsearch HTTP', category: 'Database' },
  { port: 9300, protocol: 'TCP', service: 'Elasticsearch', description: 'Elasticsearch Transport', category: 'Database' },
  
  // Remote Access
  { port: 3389, protocol: 'TCP', service: 'RDP', description: 'Remote Desktop Protocol', category: 'Remote Access', notes: 'Use VPN, common attack target' },
  { port: 5900, protocol: 'TCP', service: 'VNC', description: 'Virtual Network Computing', category: 'Remote Access', notes: 'Use over SSH tunnel' },
  { port: 5901, protocol: 'TCP', service: 'VNC-1', description: 'VNC Display :1', category: 'Remote Access' },
  
  // Web Development
  { port: 3000, protocol: 'TCP', service: 'Dev', description: 'Node.js/React Dev Server', category: 'Development' },
  { port: 4200, protocol: 'TCP', service: 'Angular', description: 'Angular Dev Server', category: 'Development' },
  { port: 5000, protocol: 'TCP', service: 'Dev', description: 'Flask/ASP.NET Dev', category: 'Development' },
  { port: 5173, protocol: 'TCP', service: 'Vite', description: 'Vite Dev Server', category: 'Development' },
  { port: 8000, protocol: 'TCP', service: 'Dev', description: 'Django/Python Dev', category: 'Development' },
  { port: 8080, protocol: 'TCP', service: 'HTTP-Alt', description: 'HTTP Alternate/Proxy', category: 'Web' },
  { port: 8443, protocol: 'TCP', service: 'HTTPS-Alt', description: 'HTTPS Alternate', category: 'Web', secure: true },
  { port: 8888, protocol: 'TCP', service: 'Jupyter', description: 'Jupyter Notebook', category: 'Development' },
  
  // Messaging & Collaboration
  { port: 1883, protocol: 'TCP', service: 'MQTT', description: 'Message Queuing Telemetry', category: 'IoT/Messaging' },
  { port: 5222, protocol: 'TCP', service: 'XMPP', description: 'XMPP Client', category: 'Messaging' },
  { port: 5223, protocol: 'TCP', service: 'XMPP-SSL', description: 'XMPP Client over SSL', category: 'Messaging', secure: true },
  { port: 5269, protocol: 'TCP', service: 'XMPP-S2S', description: 'XMPP Server-to-Server', category: 'Messaging' },
  { port: 5672, protocol: 'TCP', service: 'AMQP', description: 'RabbitMQ/AMQP', category: 'Messaging' },
  { port: 6667, protocol: 'TCP', service: 'IRC', description: 'Internet Relay Chat', category: 'Messaging' },
  { port: 6697, protocol: 'TCP', service: 'IRC-SSL', description: 'IRC over SSL', category: 'Messaging', secure: true },
  
  // VPN
  { port: 1194, protocol: 'TCP/UDP', service: 'OpenVPN', description: 'OpenVPN', category: 'VPN', secure: true },
  { port: 1701, protocol: 'UDP', service: 'L2TP', description: 'L2TP VPN', category: 'VPN' },
  { port: 1723, protocol: 'TCP', service: 'PPTP', description: 'PPTP VPN', category: 'VPN', notes: 'Deprecated, insecure' },
  { port: 4500, protocol: 'UDP', service: 'IPsec-NAT-T', description: 'IPsec NAT Traversal', category: 'VPN', secure: true },
  { port: 51820, protocol: 'UDP', service: 'WireGuard', description: 'WireGuard VPN', category: 'VPN', secure: true },
  
  // Container/Orchestration
  { port: 2375, protocol: 'TCP', service: 'Docker', description: 'Docker API (unencrypted)', category: 'Containers', notes: 'Never expose publicly' },
  { port: 2376, protocol: 'TCP', service: 'Docker-TLS', description: 'Docker API (TLS)', category: 'Containers', secure: true },
  { port: 2377, protocol: 'TCP', service: 'Swarm', description: 'Docker Swarm', category: 'Containers' },
  { port: 6443, protocol: 'TCP', service: 'Kubernetes', description: 'Kubernetes API', category: 'Containers', secure: true },
  { port: 10250, protocol: 'TCP', service: 'Kubelet', description: 'Kubernetes Kubelet', category: 'Containers' },
  { port: 30000, protocol: 'TCP', service: 'K8s NodePort', description: 'Kubernetes NodePort Range Start', category: 'Containers' },
  { port: 32767, protocol: 'TCP', service: 'K8s NodePort', description: 'Kubernetes NodePort Range End', category: 'Containers' },
  
  // Monitoring
  { port: 3100, protocol: 'TCP', service: 'Loki', description: 'Grafana Loki', category: 'Monitoring' },
  { port: 9090, protocol: 'TCP', service: 'Prometheus', description: 'Prometheus', category: 'Monitoring' },
  { port: 9093, protocol: 'TCP', service: 'Alertmanager', description: 'Prometheus Alertmanager', category: 'Monitoring' },
  { port: 3000, protocol: 'TCP', service: 'Grafana', description: 'Grafana Dashboard', category: 'Monitoring' },
  { port: 8086, protocol: 'TCP', service: 'InfluxDB', description: 'InfluxDB HTTP API', category: 'Monitoring' },
  { port: 5601, protocol: 'TCP', service: 'Kibana', description: 'Kibana Dashboard', category: 'Monitoring' },
  { port: 9100, protocol: 'TCP', service: 'Node Exporter', description: 'Prometheus Node Exporter', category: 'Monitoring' },
  
  // Network Gear
  { port: 830, protocol: 'TCP', service: 'NETCONF', description: 'NETCONF over SSH', category: 'Network Management', secure: true },
  { port: 4786, protocol: 'TCP', service: 'Cisco-SMI', description: 'Cisco Smart Install', category: 'Network Management', notes: 'Often vulnerable' },
  { port: 6633, protocol: 'TCP', service: 'OpenFlow', description: 'OpenFlow Legacy', category: 'SDN' },
  { port: 6653, protocol: 'TCP', service: 'OpenFlow', description: 'OpenFlow Standard', category: 'SDN' },
  
  // Streaming/Gaming
  { port: 1935, protocol: 'TCP', service: 'RTMP', description: 'Real-Time Messaging Protocol', category: 'Streaming' },
  { port: 8554, protocol: 'TCP', service: 'RTSP', description: 'RTSP Alternate', category: 'Streaming' },
  { port: 25565, protocol: 'TCP', service: 'Minecraft', description: 'Minecraft Java Edition', category: 'Gaming' },
  { port: 27015, protocol: 'UDP', service: 'Steam', description: 'Steam Game Server', category: 'Gaming' },
  
  // AWS Services
  { port: 443, protocol: 'TCP', service: 'AWS API', description: 'AWS API Endpoints', category: 'AWS', secure: true },
  { port: 9443, protocol: 'TCP', service: 'ECS Exec', description: 'ECS Exec', category: 'AWS', secure: true },
]

/**
 * Get unique categories
 */
function getCategories(ports: PortEntry[]): string[] {
  return [...new Set(ports.map(p => p.category))].sort()
}

export default function PortReferenceTool() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [showSecureOnly, setShowSecureOnly] = useState(false)

  const filteredPorts = useMemo(() => {
    return PORT_DATABASE.filter(entry => {
      // Category filter
      if (selectedCategory !== 'All' && entry.category !== selectedCategory) {
        return false
      }
      
      // Secure filter
      if (showSecureOnly && !entry.secure) {
        return false
      }
      
      // Search filter
      if (search.trim()) {
        const searchLower = search.toLowerCase()
        const portStr = String(entry.port)
        return (
          portStr.includes(search) ||
          entry.service.toLowerCase().includes(searchLower) ||
          entry.description.toLowerCase().includes(searchLower) ||
          (entry.notes?.toLowerCase().includes(searchLower) ?? false)
        )
      }
      
      return true
    })
  }, [search, selectedCategory, showSecureOnly])

  const categories = useMemo(() => getCategories(PORT_DATABASE), [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Port Reference</h1>
        <p className="text-gray-400 mt-1">
          Searchable database of {PORT_DATABASE.length}+ common network ports
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by port, service, or description..."
              className="input"
            />
          </div>
          <div className="min-w-[150px]">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input"
            >
              <option value="All">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={showSecureOnly}
              onChange={(e) => setShowSecureOnly(e.target.checked)}
              className="rounded border-[#30363d] bg-[#21262d] text-blue-500 focus:ring-blue-500/20"
            />
            Secure Only
          </label>
        </div>
      </div>

      {/* Results */}
      {filteredPorts.length > 0 && (
        <div className="flex items-center justify-end">
          <AddToReportButton
            toolId="port-reference"
            input={`Search: ${search || 'All'}, Category: ${selectedCategory}`}
            data={filteredPorts}
            category="Network Intelligence"
          />
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#30363d]">
          <span className="text-sm text-gray-400">
            Showing {filteredPorts.length} of {PORT_DATABASE.length} ports
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#161b22]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Port</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Protocol</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Service</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d]">
              {filteredPorts.map((entry, index) => (
                <tr key={index} className="hover:bg-[#161b22]">
                  <td className="px-4 py-3">
                    <span className="font-mono text-blue-400">{entry.port}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      entry.protocol === 'TCP' ? 'bg-cyan-500/20 text-cyan-400' :
                      entry.protocol === 'UDP' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {entry.protocol}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-white">
                    {entry.service}
                    {entry.secure && (
                      <span className="ml-2 text-emerald-400" title="Secure">🔒</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{entry.description}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-[#21262d] text-gray-300">
                      {entry.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-yellow-400">
                    {entry.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredPorts.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No ports match your search criteria
          </div>
        )}
      </div>
    </div>
  )
}

