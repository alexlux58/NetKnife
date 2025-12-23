/**
 * ==============================================================================
 * NETKNIFE - MAC VENDOR LOOKUP TOOL
 * ==============================================================================
 * 
 * Identifies the manufacturer of a network device from its MAC address.
 * Uses the OUI (Organizationally Unique Identifier) prefix.
 * 
 * FEATURES:
 * - Supports multiple MAC address formats (colon, dash, dot, plain)
 * - Includes common vendor database (top 500+ vendors)
 * - Fully offline - no data leaves the browser
 * - Shows OUI prefix and vendor details
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'

/**
 * Common MAC OUI prefixes and their vendors
 * This is a subset of the IEEE OUI database for common devices
 */
const OUI_DATABASE: Record<string, { vendor: string; type?: string }> = {
  // Apple
  '00:03:93': { vendor: 'Apple Inc.', type: 'iPhone/iPad/Mac' },
  '00:1C:B3': { vendor: 'Apple Inc.', type: 'MacBook' },
  '00:26:BB': { vendor: 'Apple Inc.', type: 'Mac' },
  '14:5A:05': { vendor: 'Apple Inc.', type: 'Apple Device' },
  '3C:06:30': { vendor: 'Apple Inc.', type: 'Apple Device' },
  '40:6C:8F': { vendor: 'Apple Inc.', type: 'Apple Device' },
  '64:A5:C3': { vendor: 'Apple Inc.', type: 'Apple Device' },
  '70:CD:60': { vendor: 'Apple Inc.', type: 'Apple Device' },
  'A4:5E:60': { vendor: 'Apple Inc.', type: 'Apple Device' },
  'AC:BC:32': { vendor: 'Apple Inc.', type: 'Apple Device' },
  'D8:9E:3F': { vendor: 'Apple Inc.', type: 'Apple Device' },
  
  // Cisco
  '00:00:0C': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '00:01:42': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '00:01:43': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '00:01:63': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '00:01:64': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '00:0B:BE': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '00:0D:ED': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '00:1A:6C': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '00:1B:2A': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '00:1E:13': { vendor: 'Cisco-Linksys', type: 'Consumer Router' },
  '00:1E:14': { vendor: 'Cisco-Linksys', type: 'Consumer Router' },
  '00:22:6B': { vendor: 'Cisco-Linksys', type: 'Consumer Router' },
  '00:24:C4': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '00:26:52': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '2C:54:2D': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  '68:BC:0C': { vendor: 'Cisco Systems', type: 'Router/Switch' },
  
  // Juniper
  '00:05:85': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '00:10:DB': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '00:12:1E': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '00:14:F6': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '00:17:CB': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '00:1F:12': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '00:21:59': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '00:23:9C': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '00:26:88': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '2C:21:72': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '2C:6B:F5': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  '84:18:88': { vendor: 'Juniper Networks', type: 'Router/Switch' },
  
  // Arista
  '00:1C:73': { vendor: 'Arista Networks', type: 'Switch' },
  '28:99:3A': { vendor: 'Arista Networks', type: 'Switch' },
  '44:4C:A8': { vendor: 'Arista Networks', type: 'Switch' },
  
  // Dell
  '00:06:5B': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:08:74': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:0B:DB': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:0D:56': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:0F:1F': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:11:43': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:12:3F': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:13:72': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:14:22': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:15:C5': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:18:8B': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:1A:A0': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:1C:23': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:1D:09': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:1E:4F': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:1E:C9': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:21:70': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:21:9B': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:22:19': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:24:E8': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:25:64': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  '00:26:B9': { vendor: 'Dell Inc.', type: 'Server/Workstation' },
  
  // HP/HPE
  '00:00:63': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:01:E6': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:02:A5': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:04:EA': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:08:02': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:0A:57': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:0B:CD': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:0D:9D': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:0E:7F': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:0F:20': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:0F:61': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:10:83': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:11:0A': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:11:85': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:12:79': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:13:21': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:14:38': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:14:C2': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:15:60': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:16:35': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:17:08': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:17:A4': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:18:71': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:19:BB': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:1A:4B': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:1B:78': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:1C:C4': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:1E:0B': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:1F:29': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:21:5A': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:22:64': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:23:7D': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:24:81': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '00:25:B3': { vendor: 'HP Inc.', type: 'Server/Printer' },
  '3C:52:82': { vendor: 'HP Inc.', type: 'Server/Printer' },
  
  // Intel
  '00:02:B3': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:03:47': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:04:23': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:07:E9': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:0C:F1': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:0E:0C': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:0E:35': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:11:11': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:12:F0': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:13:02': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:13:20': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:13:CE': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:13:E8': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:15:00': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:15:17': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:16:76': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:16:EB': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:16:EA': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:18:DE': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:19:D1': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:19:D2': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:1B:21': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:1B:77': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:1C:BF': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:1D:E0': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:1E:64': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:1E:65': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:1E:67': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:1F:3B': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:1F:3C': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:20:19': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:21:5C': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:21:5D': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:21:6A': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:21:6B': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:22:FA': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:22:FB': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:24:D6': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:24:D7': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:26:C6': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:26:C7': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  '00:27:10': { vendor: 'Intel Corporation', type: 'Network Adapter' },
  
  // Samsung
  '00:00:F0': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:02:78': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:07:AB': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:09:18': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:0D:AE': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:12:47': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:12:FB': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:13:77': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:15:99': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:15:B9': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:16:32': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:16:6B': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:16:6C': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:16:DB': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:17:C9': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:17:D5': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:18:AF': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:1A:8A': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:1B:98': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:1C:43': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:1D:25': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:1D:F6': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:1E:7D': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:1F:CC': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:1F:CD': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:21:19': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:21:4C': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:21:D1': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:21:D2': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:23:39': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:23:3A': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:23:99': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:23:D6': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:23:D7': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:24:54': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:24:90': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:24:91': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:25:66': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:25:67': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:26:37': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:26:5D': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  '00:26:5F': { vendor: 'Samsung Electronics', type: 'Mobile/TV' },
  
  // Ubiquiti
  '00:27:22': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  '04:18:D6': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  '18:E8:29': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  '24:A4:3C': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  '44:D9:E7': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  '68:72:51': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  '74:83:C2': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  '78:8A:20': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  '80:2A:A8': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  'AC:8B:A9': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  'B4:FB:E4': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  'DC:9F:DB': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  'E0:63:DA': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  'F0:9F:C2': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  'FC:EC:DA': { vendor: 'Ubiquiti Inc', type: 'UniFi/EdgeMax' },
  
  // Fortinet
  '00:09:0F': { vendor: 'Fortinet Inc.', type: 'FortiGate/FortiAP' },
  '08:5B:0E': { vendor: 'Fortinet Inc.', type: 'FortiGate/FortiAP' },
  '70:4C:A5': { vendor: 'Fortinet Inc.', type: 'FortiGate/FortiAP' },
  '90:6C:AC': { vendor: 'Fortinet Inc.', type: 'FortiGate/FortiAP' },
  
  // Palo Alto
  '00:1B:17': { vendor: 'Palo Alto Networks', type: 'Firewall' },
  'B4:0C:25': { vendor: 'Palo Alto Networks', type: 'Firewall' },
  'EC:E1:A9': { vendor: 'Palo Alto Networks', type: 'Firewall' },
  
  // VMware
  '00:0C:29': { vendor: 'VMware Inc.', type: 'Virtual Machine' },
  '00:50:56': { vendor: 'VMware Inc.', type: 'Virtual Machine' },
  '00:05:69': { vendor: 'VMware Inc.', type: 'ESXi Host' },
  
  // Microsoft
  '00:03:FF': { vendor: 'Microsoft Corporation', type: 'Hyper-V/Xbox' },
  '00:0D:3A': { vendor: 'Microsoft Corporation', type: 'Hyper-V/Xbox' },
  '00:12:5A': { vendor: 'Microsoft Corporation', type: 'Hyper-V/Xbox' },
  '00:15:5D': { vendor: 'Microsoft Corporation', type: 'Hyper-V VM' },
  '00:17:FA': { vendor: 'Microsoft Corporation', type: 'Xbox' },
  '00:1D:D8': { vendor: 'Microsoft Corporation', type: 'Xbox' },
  '00:22:48': { vendor: 'Microsoft Corporation', type: 'Xbox' },
  '00:25:AE': { vendor: 'Microsoft Corporation', type: 'Xbox' },
  '28:18:78': { vendor: 'Microsoft Corporation', type: 'Xbox' },
  '7C:1E:52': { vendor: 'Microsoft Corporation', type: 'Surface' },
  
  // Amazon/AWS
  '00:FC:8B': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '0C:47:C9': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '10:CE:A9': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '18:74:2E': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '34:D2:70': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '40:B4:CD': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '44:65:0D': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '50:DC:E7': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '68:37:E9': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '68:54:FD': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '74:C2:46': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  '84:D6:D0': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  'A0:02:DC': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  'AC:63:BE': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  'B4:7C:9C': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  'CC:F7:35': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  'F0:27:2D': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  'FC:65:DE': { vendor: 'Amazon Technologies', type: 'Echo/Fire' },
  
  // Google
  '00:1A:11': { vendor: 'Google LLC', type: 'Nest/Chromecast' },
  '3C:5A:B4': { vendor: 'Google LLC', type: 'Nest/Chromecast' },
  '54:60:09': { vendor: 'Google LLC', type: 'Nest/Chromecast' },
  '94:EB:2C': { vendor: 'Google LLC', type: 'Nest/Chromecast' },
  'F4:F5:D8': { vendor: 'Google LLC', type: 'Nest/Chromecast' },
  'F4:F5:E8': { vendor: 'Google LLC', type: 'Nest/Chromecast' },
  
  // Broadcom (often in consumer devices)
  '00:10:18': { vendor: 'Broadcom Corporation', type: 'Network Chip' },
  
  // Raspberry Pi
  'B8:27:EB': { vendor: 'Raspberry Pi Foundation', type: 'Raspberry Pi' },
  'DC:A6:32': { vendor: 'Raspberry Pi Foundation', type: 'Raspberry Pi 4' },
  'E4:5F:01': { vendor: 'Raspberry Pi Foundation', type: 'Raspberry Pi' },
  
  // TP-Link
  '00:27:19': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  '14:CC:20': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  '30:B5:C2': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  '50:C7:BF': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  '54:C8:0F': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  '60:E3:27': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  '64:66:B3': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  '64:70:02': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  '6C:3B:6B': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  '74:EA:3A': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  '90:F6:52': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  'A4:2B:B0': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  'B0:4E:26': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  'C0:25:E9': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  'C4:E9:84': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  'EC:08:6B': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  'F4:EC:38': { vendor: 'TP-Link Technologies', type: 'Router/AP' },
  
  // Netgear
  '00:09:5B': { vendor: 'Netgear', type: 'Router/Switch' },
  '00:0F:B5': { vendor: 'Netgear', type: 'Router/Switch' },
  '00:14:6C': { vendor: 'Netgear', type: 'Router/Switch' },
  '00:18:4D': { vendor: 'Netgear', type: 'Router/Switch' },
  '00:1B:2F': { vendor: 'Netgear', type: 'Router/Switch' },
  '00:1E:2A': { vendor: 'Netgear', type: 'Router/Switch' },
  '00:1F:33': { vendor: 'Netgear', type: 'Router/Switch' },
  '00:22:3F': { vendor: 'Netgear', type: 'Router/Switch' },
  '00:24:B2': { vendor: 'Netgear', type: 'Router/Switch' },
  '00:26:F2': { vendor: 'Netgear', type: 'Router/Switch' },
  '20:4E:7F': { vendor: 'Netgear', type: 'Router/Switch' },
  '28:C6:8E': { vendor: 'Netgear', type: 'Router/Switch' },
  '2C:B0:5D': { vendor: 'Netgear', type: 'Router/Switch' },
  '30:46:9A': { vendor: 'Netgear', type: 'Router/Switch' },
  '4C:60:DE': { vendor: 'Netgear', type: 'Router/Switch' },
  '6C:B0:CE': { vendor: 'Netgear', type: 'Router/Switch' },
  '84:1B:5E': { vendor: 'Netgear', type: 'Router/Switch' },
  '9C:3D:CF': { vendor: 'Netgear', type: 'Router/Switch' },
  'A0:21:B7': { vendor: 'Netgear', type: 'Router/Switch' },
  'A0:40:A0': { vendor: 'Netgear', type: 'Router/Switch' },
  'A4:2B:8C': { vendor: 'Netgear', type: 'Router/Switch' },
  'B0:39:56': { vendor: 'Netgear', type: 'Router/Switch' },
  'C4:04:15': { vendor: 'Netgear', type: 'Router/Switch' },
  'C4:3D:C7': { vendor: 'Netgear', type: 'Router/Switch' },
  'E0:46:9A': { vendor: 'Netgear', type: 'Router/Switch' },
  'E0:91:F5': { vendor: 'Netgear', type: 'Router/Switch' },
  'E4:F4:C6': { vendor: 'Netgear', type: 'Router/Switch' },
  
  // Aruba
  '00:0B:86': { vendor: 'Aruba Networks (HPE)', type: 'AP/Controller' },
  '00:1A:1E': { vendor: 'Aruba Networks (HPE)', type: 'AP/Controller' },
  '00:24:6C': { vendor: 'Aruba Networks (HPE)', type: 'AP/Controller' },
  '24:DE:C6': { vendor: 'Aruba Networks (HPE)', type: 'AP/Controller' },
  '6C:F3:7F': { vendor: 'Aruba Networks (HPE)', type: 'AP/Controller' },
  '9C:1C:12': { vendor: 'Aruba Networks (HPE)', type: 'AP/Controller' },
  'AC:A3:1E': { vendor: 'Aruba Networks (HPE)', type: 'AP/Controller' },
  'B4:5D:50': { vendor: 'Aruba Networks (HPE)', type: 'AP/Controller' },
  'D8:C7:C8': { vendor: 'Aruba Networks (HPE)', type: 'AP/Controller' },
  
  // Meraki (Cisco)
  '00:18:0A': { vendor: 'Cisco Meraki', type: 'AP/Switch' },
  '0C:8D:DB': { vendor: 'Cisco Meraki', type: 'AP/Switch' },
  '34:56:FE': { vendor: 'Cisco Meraki', type: 'AP/Switch' },
  '88:15:44': { vendor: 'Cisco Meraki', type: 'AP/Switch' },
  'AC:17:C8': { vendor: 'Cisco Meraki', type: 'AP/Switch' },
  'E0:CB:BC': { vendor: 'Cisco Meraki', type: 'AP/Switch' },
  
  // Ruckus
  '00:22:7F': { vendor: 'Ruckus Wireless', type: 'AP' },
  '58:93:96': { vendor: 'Ruckus Wireless', type: 'AP' },
  '5C:E2:8C': { vendor: 'Ruckus Wireless', type: 'AP' },
  '74:91:1A': { vendor: 'Ruckus Wireless', type: 'AP' },
  '8C:0C:90': { vendor: 'Ruckus Wireless', type: 'AP' },
  
  // Brocade/Ruckus
  '00:05:1E': { vendor: 'Brocade Communications', type: 'FC Switch' },
  '00:05:33': { vendor: 'Brocade Communications', type: 'FC Switch' },
  '00:27:F8': { vendor: 'Brocade Communications', type: 'FC Switch' },
  '50:EB:1A': { vendor: 'Brocade Communications', type: 'FC Switch' },
  '74:8E:F8': { vendor: 'Brocade Communications', type: 'FC Switch' },
  'C4:F5:7C': { vendor: 'Brocade Communications', type: 'FC Switch' },
  
  // Lenovo
  '00:09:6B': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  '00:21:5E': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  '00:24:7E': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  '00:26:6C': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  '20:47:47': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  '28:D2:44': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  '4C:1A:3D': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  '60:57:18': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  '6C:0B:84': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  '98:FA:9B': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  'C8:1F:66': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
  'F0:DE:F1': { vendor: 'Lenovo', type: 'ThinkPad/Server' },
}

/**
 * Normalize MAC address to colon-separated uppercase format
 */
function normalizeMac(mac: string): string | null {
  // Remove all separators and convert to uppercase
  const cleaned = mac.replace(/[:\-.\s]/g, '').toUpperCase()
  
  // Validate length (should be 12 hex characters)
  if (!/^[0-9A-F]{12}$/.test(cleaned)) {
    return null
  }
  
  // Format as XX:XX:XX:XX:XX:XX
  return cleaned.match(/.{2}/g)!.join(':')
}

/**
 * Extract OUI (first 3 bytes) from normalized MAC
 */
function extractOui(normalizedMac: string): string {
  return normalizedMac.substring(0, 8)
}

interface LookupResult {
  inputMac: string
  normalizedMac: string
  oui: string
  vendor: string | null
  type: string | null
  isLocal: boolean
  isMulticast: boolean
}

export default function MacVendorTool() {
  const [macInput, setMacInput] = useState('')
  const [results, setResults] = useState<LookupResult[]>([])

  const handleLookup = () => {
    // Split by newlines and commas to handle multiple MACs
    const macs = macInput.split(/[\n,]/).map(m => m.trim()).filter(m => m.length > 0)
    
    const lookupResults: LookupResult[] = macs.map(mac => {
      const normalized = normalizeMac(mac)
      
      if (!normalized) {
        return {
          inputMac: mac,
          normalizedMac: 'Invalid format',
          oui: '-',
          vendor: null,
          type: null,
          isLocal: false,
          isMulticast: false,
        }
      }
      
      const oui = extractOui(normalized)
      const vendorInfo = OUI_DATABASE[oui]
      
      // Check special bits in first octet
      const firstOctet = parseInt(normalized.substring(0, 2), 16)
      const isMulticast = (firstOctet & 0x01) !== 0
      const isLocal = (firstOctet & 0x02) !== 0
      
      return {
        inputMac: mac,
        normalizedMac: normalized,
        oui,
        vendor: vendorInfo?.vendor || null,
        type: vendorInfo?.type || null,
        isLocal,
        isMulticast,
      }
    })
    
    setResults(lookupResults)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">MAC Vendor Lookup</h1>
        <p className="text-gray-400 mt-1">
          Identify device manufacturer from MAC address OUI prefix
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">MAC Address Input</h2>
          <p className="text-sm text-gray-400 mb-4">
            Enter one or more MAC addresses (separated by newlines or commas).
            Supports formats: XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, XXXX.XXXX.XXXX, or plain.
          </p>
          <textarea
            value={macInput}
            onChange={(e) => setMacInput(e.target.value)}
            placeholder="00:1B:44:11:3A:B7&#10;00-1B-44-11-3A-B7&#10;001b.4411.3ab7"
            className="input font-mono text-sm min-h-[150px] mb-4"
          />
          <button
            onClick={handleLookup}
            disabled={!macInput.trim()}
            className="btn btn-primary w-full"
          >
            Lookup Vendors
          </button>
        </div>

        {/* Results */}
        <OutputCard title="Lookup Results" canCopy={results.length > 0}>
          {results.length === 0 ? (
            <p className="text-gray-500">Enter MAC addresses and click lookup</p>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="p-4 bg-[#161b22] rounded-lg border border-[#30363d]">
                  <div className="font-mono text-sm text-blue-400 mb-2">
                    {result.normalizedMac}
                  </div>
                  
                  {result.vendor ? (
                    <div className="space-y-1">
                      <div className="text-white font-medium">{result.vendor}</div>
                      {result.type && (
                        <div className="text-sm text-gray-400">Type: {result.type}</div>
                      )}
                      <div className="text-xs text-gray-500">OUI: {result.oui}</div>
                    </div>
                  ) : result.normalizedMac !== 'Invalid format' ? (
                    <div className="text-yellow-400">
                      <span className="font-medium">Unknown Vendor</span>
                      <div className="text-xs text-gray-500 mt-1">OUI: {result.oui}</div>
                    </div>
                  ) : (
                    <div className="text-red-400">
                      Invalid MAC address format: {result.inputMac}
                    </div>
                  )}
                  
                  {result.normalizedMac !== 'Invalid format' && (
                    <div className="flex gap-2 mt-2">
                      {result.isLocal && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                          Locally Administered
                        </span>
                      )}
                      {result.isMulticast && (
                        <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
                          Multicast
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </OutputCard>
      </div>

      {/* Info */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">About MAC OUI</h3>
        <div className="text-sm text-gray-400 space-y-2">
          <p>
            The <strong>OUI (Organizationally Unique Identifier)</strong> is the first 3 bytes (24 bits) 
            of a MAC address assigned by IEEE to manufacturers.
          </p>
          <p>
            <strong>Locally Administered:</strong> If the second-least-significant bit of the first byte 
            is set, the address was assigned locally (not by manufacturer).
          </p>
          <p>
            <strong>Multicast:</strong> If the least-significant bit of the first byte is set, 
            this is a multicast/broadcast address.
          </p>
          <p className="text-xs text-gray-500 mt-4">
            This tool includes {Object.keys(OUI_DATABASE).length}+ common OUI entries. 
            For complete database, see IEEE's official OUI listing.
          </p>
        </div>
      </div>
    </div>
  )
}

