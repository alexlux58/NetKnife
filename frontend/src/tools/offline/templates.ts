/**
 * ==============================================================================
 * NETKNIFE - COMMAND TEMPLATES DATABASE
 * ==============================================================================
 * 
 * This file contains all command templates for various network vendors.
 * 
 * TEMPLATE STRUCTURE:
 * - id: Unique identifier
 * - vendor: Device vendor (Cisco, Arista, Juniper, etc.)
 * - feature: Feature category (Routing, Switching, etc.)
 * - task: Specific task (Static Route, BGP Verify, etc.)
 * - title: Human-readable title
 * - inputs: Variables that can be substituted
 * - commands: Main commands to execute
 * - verify: Commands to verify the change
 * - rollback: Commands to undo the change
 * - notes: Additional notes or warnings
 * 
 * VARIABLE SYNTAX:
 * Use {{variable_name}} in commands for substitution.
 * ==============================================================================
 */

/**
 * Input field definition
 */
export interface TemplateInput {
  key: string
  label: string
  placeholder: string
}

/**
 * Command template definition
 */
export interface CommandTemplate {
  id: string
  vendor: string
  feature: string
  task: string
  title: string
  inputs: TemplateInput[]
  commands: string[]
  verify?: string[]
  rollback?: string[]
  notes?: string[]
}

/**
 * Renders a template string with variable substitution
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`)
}

/**
 * All command templates
 */
export const templates: CommandTemplate[] = [
  // ============================================================================
  // STATIC ROUTES
  // ============================================================================
  {
    id: 'static-route-cisco',
    vendor: 'Cisco IOS',
    feature: 'Routing',
    task: 'Static Route',
    title: 'Add Static Route',
    inputs: [
      { key: 'prefix', label: 'Destination Prefix', placeholder: '203.0.113.0' },
      { key: 'mask', label: 'Subnet Mask', placeholder: '255.255.255.0' },
      { key: 'nexthop', label: 'Next-hop IP', placeholder: '192.0.2.1' },
    ],
    commands: [
      'conf t',
      'ip route {{prefix}} {{mask}} {{nexthop}}',
      'end',
      'write memory',
    ],
    verify: [
      'show ip route {{prefix}}',
      'show ip route static',
    ],
    rollback: [
      'conf t',
      'no ip route {{prefix}} {{mask}} {{nexthop}}',
      'end',
    ],
    notes: ['For VRF routes, use: ip route vrf <VRF_NAME> ...'],
  },
  {
    id: 'static-route-arista',
    vendor: 'Arista EOS',
    feature: 'Routing',
    task: 'Static Route',
    title: 'Add Static Route',
    inputs: [
      { key: 'prefix', label: 'Destination CIDR', placeholder: '203.0.113.0/24' },
      { key: 'nexthop', label: 'Next-hop IP', placeholder: '192.0.2.1' },
    ],
    commands: [
      'conf t',
      'ip route {{prefix}} {{nexthop}}',
      'end',
      'write memory',
    ],
    verify: ['show ip route {{prefix}}'],
    rollback: ['conf t', 'no ip route {{prefix}} {{nexthop}}', 'end'],
  },
  {
    id: 'static-route-junos',
    vendor: 'Juniper Junos',
    feature: 'Routing',
    task: 'Static Route',
    title: 'Add Static Route',
    inputs: [
      { key: 'prefix', label: 'Destination Prefix', placeholder: '203.0.113.0/24' },
      { key: 'nexthop', label: 'Next-hop IP', placeholder: '192.0.2.1' },
    ],
    commands: [
      'configure',
      'set routing-options static route {{prefix}} next-hop {{nexthop}}',
      'commit',
    ],
    verify: ['show route {{prefix}}'],
    rollback: ['configure', 'delete routing-options static route {{prefix}}', 'commit'],
  },
  {
    id: 'static-route-fortios',
    vendor: 'FortiOS',
    feature: 'Routing',
    task: 'Static Route',
    title: 'Add Static Route',
    inputs: [
      { key: 'prefix', label: 'Destination CIDR', placeholder: '203.0.113.0/24' },
      { key: 'gateway', label: 'Gateway IP', placeholder: '192.0.2.1' },
      { key: 'device', label: 'Interface', placeholder: 'port1' },
    ],
    commands: [
      'config router static',
      '    edit 0',
      '        set dst {{prefix}}',
      '        set gateway {{gateway}}',
      '        set device "{{device}}"',
      '    next',
      'end',
    ],
    verify: ['get router info routing-table details {{prefix}}'],
    rollback: ['config router static', '    delete <route_id>', 'end'],
    notes: ['Note the route ID from "get router info routing-table" for deletion'],
  },
  {
    id: 'static-route-linux',
    vendor: 'Linux',
    feature: 'Routing',
    task: 'Static Route',
    title: 'Add Static Route (iproute2)',
    inputs: [
      { key: 'prefix', label: 'Destination CIDR', placeholder: '203.0.113.0/24' },
      { key: 'nexthop', label: 'Next-hop IP', placeholder: '192.168.1.1' },
      { key: 'device', label: 'Interface', placeholder: 'eth0' },
    ],
    commands: ['sudo ip route add {{prefix}} via {{nexthop}} dev {{device}}'],
    verify: ['ip route show {{prefix}}', 'ip route get {{prefix}}'],
    rollback: ['sudo ip route del {{prefix}} via {{nexthop}} dev {{device}}'],
    notes: ['Add to /etc/network/interfaces or netplan for persistence'],
  },

  // ============================================================================
  // BGP TROUBLESHOOTING
  // ============================================================================
  {
    id: 'bgp-verify-cisco',
    vendor: 'Cisco IOS',
    feature: 'Routing',
    task: 'BGP Verify',
    title: 'BGP Neighbor Troubleshooting',
    inputs: [
      { key: 'peer', label: 'Peer IP', placeholder: '198.51.100.1' },
    ],
    commands: [
      'show ip bgp summary',
      'show ip bgp neighbors {{peer}}',
      'show ip route {{peer}}',
      'show tcp brief | include :179',
    ],
    notes: [
      'Check: ASN mismatch, MD5 auth, source interface',
      'Check: Prefix-lists, route-maps blocking routes',
      'Check: Next-hop reachability',
    ],
  },
  {
    id: 'bgp-verify-junos',
    vendor: 'Juniper Junos',
    feature: 'Routing',
    task: 'BGP Verify',
    title: 'BGP Neighbor Troubleshooting',
    inputs: [
      { key: 'peer', label: 'Peer IP', placeholder: '198.51.100.1' },
    ],
    commands: [
      'show bgp summary',
      'show bgp neighbor {{peer}}',
      'show route {{peer}}',
      'show configuration protocols bgp | display set | match {{peer}}',
    ],
  },

  // ============================================================================
  // OSPF TROUBLESHOOTING
  // ============================================================================
  {
    id: 'ospf-verify-cisco',
    vendor: 'Cisco IOS',
    feature: 'Routing',
    task: 'OSPF Verify',
    title: 'OSPF Neighbor Troubleshooting',
    inputs: [],
    commands: [
      'show ip ospf neighbor',
      'show ip ospf interface brief',
      'show ip route ospf',
    ],
    notes: [
      'Common issues: Area ID mismatch, network type mismatch',
      'Check: MTU mismatch, hello/dead timers, authentication',
    ],
  },

  // ============================================================================
  // VLANs
  // ============================================================================
  {
    id: 'vlan-create-cisco',
    vendor: 'Cisco IOS',
    feature: 'Switching',
    task: 'VLAN',
    title: 'Create VLAN and Assign Port',
    inputs: [
      { key: 'vlan_id', label: 'VLAN ID', placeholder: '100' },
      { key: 'vlan_name', label: 'VLAN Name', placeholder: 'USERS' },
      { key: 'interface', label: 'Interface', placeholder: 'Gi1/0/10' },
    ],
    commands: [
      'conf t',
      'vlan {{vlan_id}}',
      ' name {{vlan_name}}',
      'interface {{interface}}',
      ' switchport mode access',
      ' switchport access vlan {{vlan_id}}',
      ' spanning-tree portfast',
      'end',
      'write memory',
    ],
    verify: [
      'show vlan brief | include {{vlan_id}}',
      'show interfaces {{interface}} switchport',
    ],
    rollback: [
      'conf t',
      'interface {{interface}}',
      ' no switchport access vlan',
      'no vlan {{vlan_id}}',
      'end',
    ],
  },

  // ============================================================================
  // L2 TROUBLESHOOTING
  // ============================================================================
  {
    id: 'l2-find-mac-cisco',
    vendor: 'Cisco IOS',
    feature: 'Switching',
    task: 'L2 Troubleshooting',
    title: 'Find MAC Address',
    inputs: [
      { key: 'mac', label: 'MAC Address', placeholder: 'aabb.ccdd.eeff' },
    ],
    commands: [
      'show mac address-table | include {{mac}}',
      'show arp | include {{mac}}',
    ],
    notes: ['Cisco format: aabb.ccdd.eeff (dots every 4 chars)'],
  },
  {
    id: 'l2-find-ip-cisco',
    vendor: 'Cisco IOS',
    feature: 'Switching',
    task: 'L2 Troubleshooting',
    title: 'Find IP in ARP/MAC Table',
    inputs: [
      { key: 'ip', label: 'IP Address', placeholder: '192.168.1.100' },
    ],
    commands: [
      'show arp | include {{ip}}',
      'show ip arp {{ip}}',
    ],
  },

  // ============================================================================
  // SNMP COMMANDS
  // ============================================================================
  {
    id: 'snmp-walk-v2c',
    vendor: 'Linux',
    feature: 'SNMP',
    task: 'SNMP Query',
    title: 'SNMPv2c Walk',
    inputs: [
      { key: 'host', label: 'Host', placeholder: '192.168.1.1' },
      { key: 'community', label: 'Community', placeholder: 'public' },
      { key: 'oid', label: 'OID', placeholder: '1.3.6.1.2.1.1' },
    ],
    commands: [
      "snmpwalk -v2c -c '{{community}}' -t 2 -r 1 {{host}} {{oid}}",
    ],
    notes: ['Common OIDs:', '  1.3.6.1.2.1.1 - System info', '  1.3.6.1.2.1.2.2 - Interface table'],
  },
  {
    id: 'snmp-walk-v3',
    vendor: 'Linux',
    feature: 'SNMP',
    task: 'SNMP Query',
    title: 'SNMPv3 Walk (authPriv)',
    inputs: [
      { key: 'host', label: 'Host', placeholder: '192.168.1.1' },
      { key: 'user', label: 'Username', placeholder: 'snmpuser' },
      { key: 'auth_pass', label: 'Auth Password', placeholder: 'authpass123' },
      { key: 'priv_pass', label: 'Priv Password', placeholder: 'privpass123' },
      { key: 'oid', label: 'OID', placeholder: '1.3.6.1.2.1.1' },
    ],
    commands: [
      "snmpwalk -v3 -l authPriv \\",
      "  -u '{{user}}' \\",
      "  -a SHA -A '{{auth_pass}}' \\",
      "  -x AES -X '{{priv_pass}}' \\",
      "  -t 2 -r 1 {{host}} {{oid}}",
    ],
    notes: ['Prefer SNMPv3 with authPriv for security'],
  },

  // ============================================================================
  // LDAP COMMANDS
  // ============================================================================
  {
    id: 'ldap-search-user',
    vendor: 'Linux',
    feature: 'LDAP',
    task: 'LDAP Query',
    title: 'LDAP Search User',
    inputs: [
      { key: 'host', label: 'LDAP Host', placeholder: 'ldap.example.com' },
      { key: 'bind_dn', label: 'Bind DN', placeholder: 'cn=binduser,dc=example,dc=com' },
      { key: 'base_dn', label: 'Base DN', placeholder: 'dc=example,dc=com' },
      { key: 'username', label: 'Username', placeholder: 'jdoe' },
    ],
    commands: [
      'ldapsearch -H "ldap://{{host}}:389" -ZZ \\',
      '  -D "{{bind_dn}}" -W \\',
      '  -b "{{base_dn}}" -s sub \\',
      '  "(uid={{username}})" cn mail memberOf',
    ],
    notes: ['-W prompts for password', '-ZZ enforces StartTLS'],
  },

  // ============================================================================
  // SMTP DIAGNOSTICS
  // ============================================================================
  {
    id: 'smtp-test-starttls',
    vendor: 'Linux',
    feature: 'SMTP',
    task: 'SMTP Test',
    title: 'Test SMTP STARTTLS',
    inputs: [
      { key: 'host', label: 'SMTP Host', placeholder: 'smtp.example.com' },
    ],
    commands: [
      '# Check port reachability',
      'nc -vz {{host}} 587',
      '',
      '# Test STARTTLS handshake',
      'openssl s_client -starttls smtp -connect {{host}}:587 -servername {{host}} -showcerts',
    ],
  },
]

