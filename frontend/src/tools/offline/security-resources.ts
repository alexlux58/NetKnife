/**
 * Security Resources Directory
 * Curated collection of security tools, platforms, and references for NetKnife users
 */

export interface SecurityResource {
  name: string;
  url: string;
  description: string;
  tags: string[];
  relatedTools?: string[]; // IDs of NetKnife tools this relates to
}

export interface ResourceCategory {
  name: string;
  description: string;
  icon: string;
  resources: SecurityResource[];
}

export const SECURITY_RESOURCES: ResourceCategory[] = [
  {
    name: "Vulnerability Intelligence",
    description: "CVE databases, exploit references, and vulnerability tracking",
    icon: "🔍",
    resources: [
      {
        name: "CVE Database (MITRE)",
        url: "https://cve.mitre.org/",
        description: "Official CVE reference database maintained by MITRE",
        tags: ["cve", "vulnerability", "reference"],
        relatedTools: ["cve-lookup", "cvss-explainer"]
      },
      {
        name: "CVE Details",
        url: "https://www.cvedetails.com/",
        description: "Enhanced CVE database with statistics, trends, and vendor information",
        tags: ["cve", "vulnerability", "statistics"],
        relatedTools: ["cve-lookup"]
      },
      {
        name: "CVSS Calculator",
        url: "https://www.first.org/cvss/calculator/3.0",
        description: "Official CVSS v3.0 calculator for vulnerability severity scoring",
        tags: ["cvss", "scoring", "calculator"],
        relatedTools: ["cvss-explainer"]
      },
      {
        name: "Exploit Database",
        url: "https://www.exploit-db.com/",
        description: "Archive of public exploits and vulnerable software",
        tags: ["exploits", "poc", "vulnerability"],
        relatedTools: ["cve-lookup"]
      },
      {
        name: "Google Hacking Database",
        url: "https://www.exploit-db.com/google-hacking-database",
        description: "Database of Google dorks for finding vulnerable systems",
        tags: ["dorks", "osint", "recon"],
        relatedTools: ["google-dorks"]
      },
      {
        name: "MITRE ATT&CK",
        url: "https://attack.mitre.org/",
        description: "Globally-accessible knowledge base of adversary tactics and techniques",
        tags: ["framework", "tactics", "threat-intel"]
      },
      {
        name: "ATT&CK Navigator",
        url: "https://mitre-attack.github.io/attack-navigator/",
        description: "Web-based tool for annotating and exploring ATT&CK matrices",
        tags: ["framework", "visualization", "threat-intel"]
      },
      {
        name: "MITRE CAR",
        url: "https://car.mitre.org/",
        description: "Cyber Analytics Repository - detection analytics mapped to ATT&CK",
        tags: ["detection", "analytics", "blue-team"]
      },
      {
        name: "MITRE Engage",
        url: "https://engage.mitre.org/",
        description: "Framework for planning and discussing adversary engagement operations",
        tags: ["framework", "adversary", "engagement"]
      }
    ]
  },
  {
    name: "Web Security Testing",
    description: "Tools and resources for web application security assessment",
    icon: "🌐",
    resources: [
      {
        name: "PortSwigger Web Security Academy",
        url: "https://portswigger.net/web-security/all-labs",
        description: "Free online web security training with interactive labs",
        tags: ["training", "labs", "web-security"],
        relatedTools: []
      },
      {
        name: "Burp Suite Certification Prep",
        url: "https://portswigger.net/web-security/certification/how-to-prepare",
        description: "Preparation guide for PortSwigger web security certification",
        tags: ["certification", "training", "burp-suite"]
      },
      {
        name: "CSP Evaluator",
        url: "https://csp-evaluator.withgoogle.com/",
        description: "Google's Content Security Policy evaluator and validator",
        tags: ["csp", "headers", "web-security"],
        relatedTools: ["http-headers"]
      },
      {
        name: "Content Security Policy Reference",
        url: "https://content-security-policy.com/",
        description: "Complete CSP directive reference and documentation",
        tags: ["csp", "headers", "reference"],
        relatedTools: ["http-headers"]
      },
      {
        name: "Security Headers Scanner",
        url: "https://securityheaders.com/",
        description: "Analyze HTTP security headers and get recommendations",
        tags: ["headers", "scanner", "web-security"],
        relatedTools: ["http-headers"]
      },
      {
        name: "Report URI Generator",
        url: "https://report-uri.com/home/generate",
        description: "Generate CSP and reporting endpoints for security headers",
        tags: ["csp", "reporting", "headers"],
        relatedTools: ["http-headers"]
      },
      {
        name: "JWT.io",
        url: "https://jwt.io/",
        description: "Decode, verify, and generate JSON Web Tokens",
        tags: ["jwt", "tokens", "auth"],
        relatedTools: ["jwt-decoder"]
      },
      {
        name: "Pythex",
        url: "https://pythex.org/",
        description: "Python regular expression tester and debugger",
        tags: ["regex", "testing", "python"]
      },
      {
        name: "Beeceptor",
        url: "https://beeceptor.com/",
        description: "Mock REST API and HTTP request inspector",
        tags: ["api", "testing", "mock"]
      },
      {
        name: "Pipedream RequestBin",
        url: "https://pipedream.com/requestbin",
        description: "Inspect HTTP requests and webhooks",
        tags: ["webhook", "testing", "http"]
      },
      {
        name: "ImageTragick",
        url: "https://imagetragick.com/",
        description: "ImageMagick vulnerability information and testing",
        tags: ["vulnerability", "imagemagick", "file-upload"]
      },
      {
        name: "XSS Game",
        url: "http://www.xssgame.com/",
        description: "Google's XSS challenge training platform",
        tags: ["xss", "training", "web-security"]
      },
      {
        name: "OWASP Favicon Database",
        url: "https://wiki.owasp.org/index.php/OWASP_favicon_database",
        description: "Database of favicon hashes for technology fingerprinting",
        tags: ["fingerprinting", "recon", "owasp"]
      }
    ]
  },
  {
    name: "Email Security",
    description: "Email validation, reputation, and authentication resources",
    icon: "📧",
    resources: [
      {
        name: "Have I Been Pwned",
        url: "https://haveibeenpwned.com/",
        description: "Check if email addresses have been compromised in data breaches",
        tags: ["breach", "email", "osint"],
        relatedTools: ["email-breach"]
      },
      {
        name: "BreachDirectory",
        url: "https://breachdirectory.org/",
        description: "Search engine for breached credentials",
        tags: ["breach", "credentials", "osint"],
        relatedTools: ["email-breach"]
      },
      {
        name: "EmailRep",
        url: "https://emailrep.io/",
        description: "Email address reputation and risk scoring",
        tags: ["reputation", "email", "threat-intel"],
        relatedTools: ["email-reputation"]
      },
      {
        name: "Hunter.io",
        url: "https://hunter.io/",
        description: "Find and verify email addresses for domain",
        tags: ["email", "osint", "verification"],
        relatedTools: ["email-verification"]
      },
      {
        name: "DMARCian - SPF Guide",
        url: "https://dmarcian.com/what-is-spf/",
        description: "Comprehensive guide to SPF email authentication",
        tags: ["spf", "email-auth", "guide"],
        relatedTools: ["email-auth-check"]
      },
      {
        name: "DMARCian - SPF Syntax",
        url: "https://dmarcian.com/spf-syntax-table/",
        description: "SPF record syntax reference table",
        tags: ["spf", "email-auth", "reference"],
        relatedTools: ["email-auth-check"]
      },
      {
        name: "Email Header Analyzer",
        url: "https://toolbox.googleapps.com/apps/messageheader/analyzeheader",
        description: "Google's email header analysis tool",
        tags: ["email", "headers", "forensics"]
      },
      {
        name: "MHA - Message Header Analyzer",
        url: "https://mha.azurewebsites.net/",
        description: "Microsoft's message header analyzer",
        tags: ["email", "headers", "forensics"]
      },
      {
        name: "Email Header Analysis",
        url: "https://mailheader.org/",
        description: "Parse and analyze email headers for security analysis",
        tags: ["email", "headers", "forensics"]
      },
      {
        name: "PhishTool",
        url: "https://www.phishtool.com/",
        description: "Email phishing analysis and threat intelligence platform",
        tags: ["phishing", "email", "threat-intel"]
      },
      {
        name: "Mailinator",
        url: "https://www.mailinator.com/v4/public/inboxes.jsp",
        description: "Disposable email inbox for testing",
        tags: ["email", "testing", "disposable"]
      }
    ]
  },
  {
    name: "OSINT & Reconnaissance",
    description: "Open-source intelligence and information gathering tools",
    icon: "🔎",
    resources: [
      {
        name: "Shodan",
        url: "https://www.shodan.io/",
        description: "Search engine for Internet-connected devices",
        tags: ["iot", "scanning", "osint"],
        relatedTools: ["shodan"]
      },
      {
        name: "Censys",
        url: "https://search.censys.io/",
        description: "Internet-wide network scanning and device discovery",
        tags: ["scanning", "osint", "recon"],
        relatedTools: ["censys"]
      },
      {
        name: "LeakIX",
        url: "https://leakix.net/",
        description: "Search engine for exposed databases and services",
        tags: ["leaks", "exposure", "osint"]
      },
      {
        name: "PublicWWW",
        url: "https://publicwww.com/",
        description: "Source code search engine for websites",
        tags: ["source-code", "osint", "recon"]
      },
      {
        name: "Wappalyzer",
        url: "https://www.wappalyzer.com/",
        description: "Identify web technologies used on websites",
        tags: ["fingerprinting", "recon", "tech-stack"]
      },
      {
        name: "Wayback Machine",
        url: "https://archive.org/web/",
        description: "Internet Archive's historical website snapshots",
        tags: ["archive", "historical", "osint"]
      },
      {
        name: "Certificate Transparency Search",
        url: "https://crt.sh/",
        description: "Search certificate transparency logs for domains",
        tags: ["certificates", "subdomain", "recon"],
        relatedTools: ["tls-inspector"]
      },
      {
        name: "Entrust CT Search",
        url: "https://ui.ctsearch.entrust.com/ui/ctsearchui",
        description: "Entrust certificate transparency search interface",
        tags: ["certificates", "ct-logs", "recon"],
        relatedTools: ["tls-inspector"]
      },
      {
        name: "DNSDumpster",
        url: "https://dnsdumpster.com/",
        description: "DNS reconnaissance and subdomain discovery",
        tags: ["dns", "subdomain", "recon"],
        relatedTools: ["dns-lookup"]
      },
      {
        name: "ViewDNS.info",
        url: "https://viewdns.info/",
        description: "Collection of DNS and network reconnaissance tools",
        tags: ["dns", "network", "recon"],
        relatedTools: ["dns-lookup"]
      },
      {
        name: "Web-Check",
        url: "https://web-check.xyz/",
        description: "All-in-one web reconnaissance tool",
        tags: ["recon", "web", "scanning"]
      },
      {
        name: "GrayHat Warfare S3 Buckets",
        url: "https://buckets.grayhatwarfare.com/",
        description: "Search for open Amazon S3 buckets",
        tags: ["cloud", "s3", "exposure"]
      },
      {
        name: "FOFA",
        url: "https://en.fofa.info/",
        description: "Cyberspace search engine",
        tags: ["scanning", "osint", "recon"]
      },
      {
        name: "GreyNoise",
        url: "https://viz.greynoise.io/",
        description: "Internet background noise and scanning activity intelligence",
        tags: ["threat-intel", "ip", "scanning"],
        relatedTools: ["ip-reputation"]
      },
      {
        name: "AbuseIPDB",
        url: "https://www.abuseipdb.com/",
        description: "IP address abuse reporting and blacklist checking",
        tags: ["ip", "reputation", "abuse"],
        relatedTools: ["ip-reputation"]
      },
      {
        name: "IPInfo",
        url: "https://ipinfo.io/",
        description: "IP address geolocation and ASN information",
        tags: ["ip", "geolocation", "asn"],
        relatedTools: ["ip-lookup"]
      },
      {
        name: "Hurricane Electric BGP Toolkit",
        url: "https://bgp.he.net/",
        description: "BGP routing and ASN information lookup",
        tags: ["bgp", "asn", "network"],
        relatedTools: ["asn-lookup"]
      },
      {
        name: "ARIN WHOIS",
        url: "https://www.arin.net/",
        description: "American Registry for Internet Numbers - IP and ASN registry",
        tags: ["whois", "asn", "registry"],
        relatedTools: ["whois-lookup"]
      },
      {
        name: "URLScan.io",
        url: "https://urlscan.io/",
        description: "Scan and analyze websites for malicious content",
        tags: ["url", "scanning", "malware"],
        relatedTools: ["url-scanner"]
      },
      {
        name: "Intelligence X",
        url: "https://intelx.io/",
        description: "Search engine for leaked data and documents",
        tags: ["leaks", "osint", "search"]
      },
      {
        name: "Whitepages",
        url: "https://www.whitepages.com/",
        description: "People search and contact information",
        tags: ["people", "osint", "phone"]
      },
      {
        name: "Fast People Search",
        url: "https://www.fastpeoplesearch.com/",
        description: "Free people search engine",
        tags: ["people", "osint", "phone"]
      },
      {
        name: "Snov.io",
        url: "https://snov.io/",
        description: "Email finder and verification platform",
        tags: ["email", "osint", "verification"]
      },
      {
        name: "ZoomInfo",
        url: "https://www.zoominfo.com/",
        description: "Business contact and company information database",
        tags: ["company", "osint", "contacts"]
      },
      {
        name: "The Org",
        url: "https://theorg.com/",
        description: "Organizational charts and company structure",
        tags: ["company", "org-chart", "osint"]
      },
      {
        name: "OpenCorporates",
        url: "https://opencorporates.com/",
        description: "Largest open database of companies in the world",
        tags: ["company", "osint", "registry"]
      },
      {
        name: "Corporation Wiki",
        url: "https://www.corporationwiki.com/",
        description: "Corporate relationship and company information",
        tags: ["company", "osint", "registry"]
      },
      {
        name: "Whoxy",
        url: "https://www.whoxy.com/",
        description: "Whois API and historical domain records",
        tags: ["whois", "domain", "historical"]
      },
      {
        name: "ICIJ Offshore Leaks",
        url: "https://offshoreleaks.icij.org/",
        description: "Offshore companies and financial structures database",
        tags: ["leaks", "financial", "osint"]
      },
      {
        name: "OCCRP Aleph",
        url: "https://aleph.occrp.org/",
        description: "Global archive of research material for investigative reporting",
        tags: ["investigations", "osint", "documents"]
      },
      {
        name: "Judy Records",
        url: "https://www.judyrecords.com/",
        description: "Court records search engine",
        tags: ["legal", "court", "osint"]
      },
      {
        name: "CourtListener",
        url: "https://www.courtlistener.com/",
        description: "Free legal opinions and resources",
        tags: ["legal", "court", "osint"]
      },
      {
        name: "TinEye Reverse Image Search",
        url: "https://tineye.com/",
        description: "Reverse image search engine",
        tags: ["image", "reverse-search", "osint"]
      },
      {
        name: "Yandex",
        url: "https://yandex.com/",
        description: "Russian search engine with reverse image search",
        tags: ["search", "image", "osint"]
      },
      {
        name: "GitHub Search",
        url: "https://github.com/search",
        description: "Search GitHub repositories and code",
        tags: ["code", "github", "osint"]
      }
    ]
  },
  {
    name: "Threat Intelligence",
    description: "Malware analysis, threat feeds, and security intelligence",
    icon: "🛡️",
    resources: [
      {
        name: "VirusTotal",
        url: "https://www.virustotal.com/",
        description: "Analyze suspicious files, URLs, domains, and IP addresses",
        tags: ["malware", "scanning", "threat-intel"],
        relatedTools: ["virustotal"]
      },
      {
        name: "VirusTotal Graph",
        url: "https://www.virustotal.com/graph/",
        description: "Visualize relationships between files, URLs, domains, and IPs",
        tags: ["malware", "visualization", "threat-intel"],
        relatedTools: ["virustotal"]
      },
      {
        name: "MalwareBazaar",
        url: "https://bazaar.abuse.ch/",
        description: "Malware sample sharing platform",
        tags: ["malware", "samples", "threat-intel"]
      },
      {
        name: "MalShare",
        url: "https://malshare.com/",
        description: "Free malware repository and sharing community",
        tags: ["malware", "samples", "threat-intel"]
      },
      {
        name: "Joe Sandbox",
        url: "https://www.joesecurity.org/",
        description: "Malware analysis and detection platform",
        tags: ["malware", "sandbox", "analysis"]
      },
      {
        name: "Hybrid Analysis",
        url: "https://www.hybrid-analysis.com/",
        description: "Free automated malware analysis service",
        tags: ["malware", "sandbox", "analysis"]
      },
      {
        name: "ANY.RUN",
        url: "https://app.any.run/",
        description: "Interactive malware analysis sandbox",
        tags: ["malware", "sandbox", "interactive"]
      },
      {
        name: "Cuckoo Sandbox",
        url: "https://cuckoosandbox.org/",
        description: "Open-source automated malware analysis system",
        tags: ["malware", "sandbox", "open-source"]
      },
      {
        name: "Valhalla YARA Rules",
        url: "https://valhalla.nextron-systems.com/",
        description: "High-quality YARA rules for malware detection",
        tags: ["yara", "malware", "detection"]
      },
      {
        name: "VirusBay",
        url: "https://beta.virusbay.io/",
        description: "Community-driven malware sample repository",
        tags: ["malware", "samples", "community"]
      },
      {
        name: "ReversingLabs",
        url: "https://www.reversinglabs.com/",
        description: "File reputation and malware analysis platform",
        tags: ["malware", "reputation", "analysis"]
      },
      {
        name: "MalAPI",
        url: "https://malapi.io/",
        description: "Windows API functions used by malware",
        tags: ["malware", "api", "windows"]
      },
      {
        name: "YARA Documentation",
        url: "https://yara.readthedocs.io/en/stable/writingrules.html",
        description: "Official YARA rule writing documentation",
        tags: ["yara", "documentation", "detection"]
      },
      {
        name: "Mandiant APT Groups",
        url: "https://www.mandiant.com/resources/insights/apt-groups",
        description: "Advanced persistent threat group profiles",
        tags: ["apt", "threat-intel", "attribution"]
      },
      {
        name: "Talos Intelligence",
        url: "https://talosintelligence.com/",
        description: "Cisco threat intelligence and research",
        tags: ["threat-intel", "reputation", "research"],
        relatedTools: ["ip-reputation"]
      },
      {
        name: "Talos Reputation Center",
        url: "https://talosintelligence.com/reputation",
        description: "IP and domain reputation lookup",
        tags: ["reputation", "ip", "domain"],
        relatedTools: ["ip-reputation"]
      },
      {
        name: "Talos File Reputation",
        url: "https://talosintelligence.com/talos_file_reputation",
        description: "File hash reputation lookup",
        tags: ["reputation", "file", "hash"]
      },
      {
        name: "Kaspersky Cyberthreat Map",
        url: "https://cybermap.kaspersky.com/",
        description: "Real-time cyber attack visualization",
        tags: ["threat-intel", "visualization", "realtime"]
      },
      {
        name: "Malware Traffic Analysis",
        url: "https://www.malware-traffic-analysis.net/",
        description: "Malware traffic capture analysis and training",
        tags: ["malware", "traffic", "training"]
      },
      {
        name: "Malware Traffic Analysis Exercises",
        url: "https://www.malware-traffic-analysis.net/training-exercises.html",
        description: "PCAP analysis training exercises",
        tags: ["malware", "training", "pcap"]
      },
      {
        name: "VX Underground",
        url: "https://www.vx-underground.org/",
        description: "Malware collection and research repository",
        tags: ["malware", "research", "samples"]
      },
      {
        name: "The Honeynet Project",
        url: "https://www.honeynet.org/",
        description: "Honeypot research and threat intelligence",
        tags: ["honeypot", "threat-intel", "research"]
      },
      {
        name: "REMnux",
        url: "https://remnux.org/",
        description: "Linux distribution for malware analysis",
        tags: ["malware", "analysis", "linux"]
      },
      {
        name: "DeHashed",
        url: "https://dehashed.com/",
        description: "Breach intelligence and credential search",
        tags: ["breach", "credentials", "threat-intel"]
      }
    ]
  },
  {
    name: "Cryptography & Encoding",
    description: "Hashing, encryption, and encoding tools",
    icon: "🔐",
    resources: [
      {
        name: "Hashcat Example Hashes",
        url: "https://hashcat.net/wiki/doku.php?id=example_hashes",
        description: "Reference list of hash types for Hashcat",
        tags: ["hashing", "cracking", "reference"],
        relatedTools: ["hash-generator"]
      },
      {
        name: "CrackStation",
        url: "https://crackstation.net/",
        description: "Free online hash cracking service",
        tags: ["hashing", "cracking", "password"],
        relatedTools: ["hash-generator"]
      },
      {
        name: "Hashes.com Hash Identifier",
        url: "https://hashes.com/en/tools/hash_identifier",
        description: "Identify hash algorithm from hash string",
        tags: ["hashing", "identification", "reference"],
        relatedTools: ["hash-generator"]
      },
      {
        name: "CyberChef",
        url: "https://gchq.github.io/CyberChef/",
        description: "Web app for encryption, encoding, compression and data analysis",
        tags: ["encoding", "crypto", "analysis"],
        relatedTools: ["base64-encoder", "url-encoder"]
      },
      {
        name: "Base64 Decode",
        url: "https://www.base64decode.org/",
        description: "Simple Base64 encoding and decoding",
        tags: ["base64", "encoding", "decoding"],
        relatedTools: ["base64-encoder"]
      },
      {
        name: "HexEd.it",
        url: "https://hexed.it/",
        description: "Browser-based hex editor",
        tags: ["hex", "editor", "binary"]
      },
      {
        name: "dCode Frequency Analysis",
        url: "https://www.dcode.fr/frequency-analysis",
        description: "Frequency analysis for cryptanalysis",
        tags: ["crypto", "analysis", "cipher"]
      },
      {
        name: "quipqiup",
        url: "https://www.quipqiup.com/",
        description: "Automatic cryptogram solver",
        tags: ["crypto", "solver", "cipher"]
      },
      {
        name: "NIST AES Standard",
        url: "https://csrc.nist.gov/pubs/fips/197/final",
        description: "Official AES encryption standard documentation",
        tags: ["aes", "encryption", "standard"]
      },
      {
        name: "OpenSSL",
        url: "https://www.openssl.org/",
        description: "Cryptography and SSL/TLS toolkit",
        tags: ["ssl", "crypto", "toolkit"]
      },
      {
        name: "GnuPG",
        url: "https://gnupg.org/",
        description: "Free implementation of OpenPGP standard",
        tags: ["pgp", "encryption", "open-source"],
        relatedTools: ["pgp-tool"]
      },
      {
        name: "PGP Tool",
        url: "https://pgptool.org/",
        description: "Online PGP key generator and message encryption",
        tags: ["pgp", "encryption", "keys"],
        relatedTools: ["pgp-tool"]
      },
      {
        name: "OWASP Password Storage Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html",
        description: "Best practices for password hashing and storage",
        tags: ["password", "hashing", "security"]
      }
    ]
  },
  {
    name: "Learning & Training",
    description: "Security training platforms, certifications, and practice labs",
    icon: "🎓",
    resources: [
      {
        name: "TryHackMe",
        url: "https://tryhackme.com/",
        description: "Gamified cybersecurity training platform",
        tags: ["training", "labs", "ctf"]
      },
      {
        name: "TryHackMe Paths",
        url: "https://tryhackme.com/paths",
        description: "Structured learning paths for various security topics",
        tags: ["training", "learning-path", "certification"]
      },
      {
        name: "TryHackMe Blue Team Path",
        url: "https://tryhackme.com/path/outline/blueteam",
        description: "Defensive security training path",
        tags: ["training", "blue-team", "defense"]
      },
      {
        name: "TryHackMe Security Engineer Path",
        url: "https://tryhackme.com/path/outline/security-engineer-training",
        description: "Security engineering training path",
        tags: ["training", "security-engineer", "certification"]
      },
      {
        name: "PentesterLab",
        url: "https://pentesterlab.com/",
        description: "Hands-on penetration testing training",
        tags: ["training", "pentesting", "labs"]
      },
      {
        name: "PortSwigger Web Security Academy",
        url: "https://portswigger.net/web-security/all-labs",
        description: "Free web security training with practical labs",
        tags: ["training", "web-security", "labs"]
      },
      {
        name: "HackerSploit",
        url: "https://hackersploit.org/",
        description: "Cybersecurity training and tutorials",
        tags: ["training", "tutorials", "pentesting"]
      },
      {
        name: "API Security University",
        url: "https://www.apisecuniversity.com/",
        description: "Free API security training courses",
        tags: ["training", "api", "security"]
      },
      {
        name: "pwnable.kr",
        url: "https://pwnable.kr/",
        description: "Binary exploitation wargame challenges",
        tags: ["training", "pwn", "exploitation"]
      },
      {
        name: "VulnHub",
        url: "https://www.vulnhub.com/",
        description: "Vulnerable VMs for hands-on pentesting practice",
        tags: ["training", "vms", "labs"]
      },
      {
        name: "Metasploitable",
        url: "https://sourceforge.net/projects/metasploitable/",
        description: "Intentionally vulnerable VM for testing",
        tags: ["training", "vm", "vulnerable"]
      },
      {
        name: "GTFOBins",
        url: "https://gtfobins.github.io/",
        description: "Unix binaries for bypassing security restrictions",
        tags: ["privilege-escalation", "unix", "reference"]
      },
      {
        name: "PayloadsAllTheThings",
        url: "https://github.com/swisskyrepo/PayloadsAllTheThings/",
        description: "Comprehensive collection of security payloads",
        tags: ["payloads", "reference", "pentesting"]
      },
      {
        name: "Reverse Shell Cheat Sheet",
        url: "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Methodology%20and%20Resources/Reverse%20Shell%20Cheatsheet.md",
        description: "Reverse shell one-liners for various languages",
        tags: ["reverse-shell", "reference", "cheatsheet"]
      },
      {
        name: "PentestMonkey Cheat Sheets",
        url: "https://pentestmonkey.net/category/cheat-sheet",
        description: "Collection of penetration testing cheat sheets",
        tags: ["cheatsheet", "reference", "pentesting"]
      },
      {
        name: "Security Certification Roadmap",
        url: "https://pauljerimy.com/security-certification-roadmap/",
        description: "Visual guide to security certifications",
        tags: ["certification", "career", "roadmap"]
      },
      {
        name: "Antisyphon Training",
        url: "https://www.antisyphontraining.com/pay-what-you-can/",
        description: "Pay-what-you-can cybersecurity training",
        tags: ["training", "affordable", "courses"]
      },
      {
        name: "SANS Information Security Policies",
        url: "https://www.sans.org/information-security-policy/",
        description: "Free security policy templates",
        tags: ["policy", "templates", "governance"]
      },
      {
        name: "Splunk Training & Certification",
        url: "https://www.splunk.com/en_us/training/certification.html",
        description: "Official Splunk training and certification programs",
        tags: ["splunk", "certification", "training"]
      },
      {
        name: "Microsoft Security Certifications",
        url: "https://learn.microsoft.com/en-us/certifications/browse/?roles=security-engineer",
        description: "Microsoft security engineer certification paths",
        tags: ["microsoft", "certification", "azure"]
      },
      {
        name: "Payatu Linux Privilege Escalation Guide",
        url: "https://payatu.com/blog/a-guide-to-linux-privilege-escalation/",
        description: "Comprehensive Linux privilege escalation techniques",
        tags: ["privilege-escalation", "linux", "guide"]
      },
      {
        name: "Eric Zimmerman's Tools",
        url: "https://ericzimmerman.github.io/",
        description: "Windows forensics and incident response tools",
        tags: ["forensics", "windows", "tools"]
      },
      {
        name: "Z Security Custom Kali",
        url: "https://zsecurity.org/download-custom-kali/",
        description: "Custom Kali Linux distribution for security testing",
        tags: ["kali", "linux", "distribution"]
      }
    ]
  },
  {
    name: "Bug Bounty Programs",
    description: "Bug bounty platforms and program directories",
    icon: "💰",
    resources: [
      {
        name: "HackerOne Programs",
        url: "https://hackerone.com/bug-bounty-programs",
        description: "Directory of bug bounty programs on HackerOne",
        tags: ["bug-bounty", "programs", "platform"]
      },
      {
        name: "HackerOne Docs",
        url: "https://docs.hackerone.com/",
        description: "HackerOne documentation for hackers and programs",
        tags: ["bug-bounty", "documentation", "guide"]
      },
      {
        name: "Bugcrowd Programs",
        url: "https://bugcrowd.com/programs",
        description: "Browse public bug bounty programs on Bugcrowd",
        tags: ["bug-bounty", "programs", "platform"]
      },
      {
        name: "Bugcrowd Vulnerability Rating Taxonomy",
        url: "https://bugcrowd.com/vulnerability-rating-taxonomy",
        description: "Bugcrowd's vulnerability classification and scoring system",
        tags: ["bug-bounty", "taxonomy", "scoring"]
      },
      {
        name: "Bugcrowd Researcher Docs",
        url: "https://docs.bugcrowd.com/researchers/",
        description: "Getting started guide for Bugcrowd researchers",
        tags: ["bug-bounty", "documentation", "guide"]
      },
      {
        name: "Intigriti",
        url: "https://www.intigriti.com/",
        description: "European bug bounty and responsible disclosure platform",
        tags: ["bug-bounty", "platform", "europe"]
      },
      {
        name: "Synack",
        url: "https://www.synack.com/",
        description: "Vetted security researcher platform",
        tags: ["bug-bounty", "platform", "vetted"]
      },
      {
        name: "Huntr",
        url: "https://huntr.dev/",
        description: "Bug bounty platform for open-source projects",
        tags: ["bug-bounty", "open-source", "platform"]
      },
      {
        name: "Zerodium",
        url: "https://zerodium.com/",
        description: "Zero-day exploit acquisition platform",
        tags: ["zero-day", "exploits", "acquisition"]
      },
      {
        name: "Zero Day Initiative",
        url: "https://www.zerodayinitiative.com/",
        description: "Trend Micro's vulnerability acquisition program",
        tags: ["zero-day", "vulnerabilities", "rewards"]
      },
      {
        name: "Pentest Reports",
        url: "https://pentestreports.com/",
        description: "Collection of public penetration test reports",
        tags: ["reports", "pentesting", "reference"]
      },
      {
        name: "Pentester Land Writeups",
        url: "https://pentester.land/writeups/",
        description: "Bug bounty writeups and learning resources",
        tags: ["writeups", "bug-bounty", "learning"]
      },
      {
        name: "Awesome Bugbounty Writeups",
        url: "https://github.com/devanshbatham/Awesome-Bugbounty-Writeups",
        description: "Curated list of bug bounty writeups",
        tags: ["writeups", "bug-bounty", "github"]
      }
    ]
  },
  {
    name: "Scanning & Enumeration Tools",
    description: "Network scanning, enumeration, and reconnaissance tools",
    icon: "📡",
    resources: [
      {
        name: "Nmap",
        url: "https://nmap.org/",
        description: "Network discovery and security auditing tool",
        tags: ["scanning", "enumeration", "network"]
      },
      {
        name: "Nmap NSE Script - MySQL Enum",
        url: "https://nmap.org/nsedoc/scripts/mysql-enum.html",
        description: "Nmap script for MySQL enumeration",
        tags: ["nmap", "mysql", "enumeration"]
      },
      {
        name: "Metasploit Framework",
        url: "https://www.metasploit.com/",
        description: "Penetration testing framework",
        tags: ["exploitation", "framework", "pentesting"]
      },
      {
        name: "Metasploit Documentation",
        url: "https://docs.metasploit.com/",
        description: "Official Metasploit documentation",
        tags: ["metasploit", "documentation", "reference"]
      },
      {
        name: "Metasploit Module Library",
        url: "https://www.infosecmatter.com/metasploit-module-library/",
        description: "Searchable Metasploit module reference",
        tags: ["metasploit", "modules", "reference"]
      },
      {
        name: "OpenVAS",
        url: "https://www.openvas.org/",
        description: "Open-source vulnerability scanner",
        tags: ["scanning", "vulnerability", "open-source"]
      },
      {
        name: "ProjectDiscovery Subfinder",
        url: "https://github.com/projectdiscovery/subfinder",
        description: "Subdomain discovery tool",
        tags: ["subdomain", "recon", "enumeration"]
      },
      {
        name: "Nuclei",
        url: "https://github.com/CyberLegionLtd/nuclei",
        description: "Fast vulnerability scanner based on templates",
        tags: ["scanning", "vulnerability", "automation"]
      },
      {
        name: "Nikto",
        url: "https://github.com/sullo/nikto",
        description: "Web server scanner for vulnerabilities",
        tags: ["scanning", "web", "vulnerability"]
      },
      {
        name: "Gobuster",
        url: "https://github.com/OJ/gobuster",
        description: "Directory/file and DNS brute-forcing tool",
        tags: ["brute-force", "enumeration", "directory"]
      },
      {
        name: "ffuf",
        url: "https://github.com/ffuf/ffuf",
        description: "Fast web fuzzer written in Go",
        tags: ["fuzzing", "web", "enumeration"]
      },
      {
        name: "DNSRecon",
        url: "https://github.com/darkoperator/dnsrecon",
        description: "DNS enumeration and reconnaissance tool",
        tags: ["dns", "enumeration", "recon"],
        relatedTools: ["dns-lookup"]
      },
      {
        name: "Sublist3r",
        url: "https://github.com/aboul3la/Sublist3r",
        description: "Fast subdomain enumeration tool",
        tags: ["subdomain", "enumeration", "recon"]
      },
      {
        name: "THC Hydra",
        url: "https://github.com/vanhauser-thc/thc-hydra",
        description: "Network logon cracker supporting numerous protocols",
        tags: ["brute-force", "password", "cracking"]
      },
      {
        name: "SecLists",
        url: "https://github.com/danielmiessler/SecLists",
        description: "Security tester's companion - wordlists collection",
        tags: ["wordlists", "fuzzing", "reference"]
      },
      {
        name: "Scapy Documentation",
        url: "https://scapy.readthedocs.io/en/latest/introduction.html",
        description: "Packet manipulation and network scanning library",
        tags: ["packets", "network", "python"]
      },
      {
        name: "pwntools Documentation",
        url: "https://docs.pwntools.com/en/stable/",
        description: "CTF framework and exploit development library",
        tags: ["ctf", "exploitation", "python"]
      },
      {
        name: "CentralOps",
        url: "https://centralops.net/co/",
        description: "Free network intelligence and investigation tools",
        tags: ["network", "intelligence", "tools"]
      },
      {
        name: "SSH Audit",
        url: "https://www.sshaudit.com/",
        description: "SSH server configuration auditing",
        tags: ["ssh", "audit", "security"]
      }
    ]
  },
  {
    name: "Offensive Security Tools",
    description: "Red team, adversary emulation, and exploitation tools",
    icon: "⚔️",
    resources: [
      {
        name: "PowerSploit",
        url: "https://github.com/PowerShellMafia/PowerSploit/",
        description: "PowerShell post-exploitation framework",
        tags: ["powershell", "post-exploitation", "windows"]
      },
      {
        name: "PowerUp",
        url: "https://github.com/PowerShellMafia/PowerSploit/blob/master/Privesc/PowerUp.ps1",
        description: "PowerShell privilege escalation framework",
        tags: ["privilege-escalation", "powershell", "windows"]
      },
      {
        name: "Rubeus",
        url: "https://github.com/GhostPack/Rubeus",
        description: "Kerberos interaction and abuse toolkit",
        tags: ["kerberos", "windows", "active-directory"]
      },
      {
        name: "Nishang",
        url: "https://github.com/samratashok/nishang",
        description: "PowerShell for offensive security and pentesting",
        tags: ["powershell", "offensive", "windows"]
      },
      {
        name: "DNSSpoof",
        url: "https://github.com/DanMcInerney/dnsspoof",
        description: "DNS spoofing tool",
        tags: ["dns", "spoofing", "mitm"]
      },
      {
        name: "Sliver C2",
        url: "https://github.com/BishopFox/sliver",
        description: "Open-source adversary emulation and red team framework",
        tags: ["c2", "red-team", "framework"]
      },
      {
        name: "Evilginx",
        url: "https://help.evilginx.com/docs/intro",
        description: "Advanced phishing framework with 2FA bypass",
        tags: ["phishing", "2fa", "mitm"]
      },
      {
        name: "BYOB (Build Your Own Botnet)",
        url: "https://github.com/malwaredllc/byob",
        description: "Open-source post-exploitation framework",
        tags: ["botnet", "post-exploitation", "framework"]
      },
      {
        name: "Grabify",
        url: "https://grabify.link/",
        description: "IP logger and URL shortener",
        tags: ["tracking", "ip", "osint"]
      },
      {
        name: "JSONBee",
        url: "https://github.com/zigoo0/JSONBee",
        description: "JSON fuzzing wordlist",
        tags: ["fuzzing", "json", "wordlist"]
      },
      {
        name: "Command Injection Payloads",
        url: "https://github.com/payloadbox/command-injection-payload-list",
        description: "Command injection payload collection",
        tags: ["payloads", "injection", "command"]
      },
      {
        name: "Active Directory Wordlists - Users",
        url: "https://github.com/Cryilllic/Active-Directory-Wordlists/blob/master/User.txt",
        description: "Common Active Directory usernames",
        tags: ["wordlist", "active-directory", "users"]
      },
      {
        name: "Active Directory Wordlists - Passwords",
        url: "https://github.com/Cryilllic/Active-Directory-Wordlists/blob/master/Pass.txt",
        description: "Common Active Directory passwords",
        tags: ["wordlist", "active-directory", "passwords"]
      },
      {
        name: "PowerShell.org",
        url: "https://powershell.org/",
        description: "Community hub for PowerShell resources",
        tags: ["powershell", "community", "resources"]
      }
    ]
  },
  {
    name: "Utilities & References",
    description: "Miscellaneous security utilities and reference materials",
    icon: "🔧",
    resources: [
      {
        name: "DNS Leak Test",
        url: "https://www.dnsleaktest.com/",
        description: "Test for DNS leaks in your VPN connection",
        tags: ["dns", "privacy", "vpn"]
      },
      {
        name: "2FA Directory",
        url: "https://2fa.directory/us/",
        description: "List of websites with 2FA support",
        tags: ["2fa", "authentication", "directory"]
      },
      {
        name: "Canarytokens",
        url: "https://canarytokens.org/generate",
        description: "Generate honeytokens for breach detection",
        tags: ["canary", "detection", "honeypot"]
      },
      {
        name: "Canarytokens Guide",
        url: "https://www.stationx.net/canarytokens/",
        description: "Complete guide to using canarytokens",
        tags: ["canary", "guide", "detection"]
      },
      {
        name: "Convert CSV - URL Extractor",
        url: "https://www.convertcsv.com/url-extractor.htm",
        description: "Extract URLs from text and documents",
        tags: ["url", "extraction", "utility"]
      },
      {
        name: "Geocode.xyz",
        url: "https://geocode.xyz/",
        description: "Geocoding API and location services",
        tags: ["geolocation", "api", "mapping"]
      },
      {
        name: "EXIF Data Viewer",
        url: "https://exifdata.com/",
        description: "View and analyze image EXIF metadata",
        tags: ["exif", "metadata", "forensics"]
      },
      {
        name: "LinangData EXIF Reader",
        url: "https://linangdata.com/exif-reader/",
        description: "Online EXIF data reader",
        tags: ["exif", "metadata", "images"]
      },
      {
        name: "Obsidian",
        url: "https://obsidian.md/",
        description: "Knowledge base and note-taking application",
        tags: ["notes", "knowledge-base", "productivity"]
      },
      {
        name: "Lucidchart",
        url: "https://lucid.app/",
        description: "Diagramming and visual collaboration platform",
        tags: ["diagrams", "visualization", "collaboration"]
      },
      {
        name: "OpenStreetMap",
        url: "https://www.openstreetmap.org/",
        description: "Collaborative open-source world map",
        tags: ["mapping", "osint", "geolocation"]
      },
      {
        name: "GeoGuessr Tips and Tricks",
        url: "https://somerandomstuff1.wordpress.com/2019/02/08/geoguessr-the-top-tips-tricks-and-techniques/",
        description: "Geolocation intelligence techniques",
        tags: ["geolocation", "osint", "tips"]
      },
      {
        name: "Splunk Documentation",
        url: "https://docs.splunk.com/Documentation",
        description: "Official Splunk product documentation",
        tags: ["splunk", "documentation", "siem"]
      },
      {
        name: "Windows Security Event List",
        url: "https://www.xplg.com/windows-server-security-events-list/",
        description: "Comprehensive Windows security event ID reference",
        tags: ["windows", "events", "forensics"]
      },
      {
        name: "Snyk",
        url: "https://snyk.io/",
        description: "Developer-first security platform for code and dependencies",
        tags: ["security", "dependencies", "devsecops"]
      },
      {
        name: "Maltego",
        url: "https://www.maltego.com/",
        description: "Link analysis and data visualization platform",
        tags: ["osint", "visualization", "analysis"]
      },
      {
        name: "CISA Cybersecurity Advisories",
        url: "https://www.cisa.gov/news-events/cybersecurity-advisories",
        description: "US government cybersecurity alerts and advisories",
        tags: ["advisories", "threat-intel", "government"]
      },
      {
        name: "Google Hacking",
        url: "https://en.wikipedia.org/wiki/Google_hacking",
        description: "Wikipedia article on Google dorking techniques",
        tags: ["dorks", "osint", "reference"],
        relatedTools: ["google-dorks"]
      },
      {
        name: "OWASP Testing Checklist",
        url: "https://github.com/wisec/OWASP-Testing-Guide-v5/",
        description: "OWASP Testing Guide checklist",
        tags: ["owasp", "checklist", "testing"]
      }
    ]
  }
];

// Flatten resources for search functionality
export const getAllResources = (): SecurityResource[] => {
  return SECURITY_RESOURCES.flatMap(category => category.resources);
};

// Get resources by tag
export const getResourcesByTag = (tag: string): SecurityResource[] => {
  return getAllResources().filter(resource =>
    resource.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
  );
};

// Get resources related to a specific NetKnife tool
export const getResourcesByToolId = (toolId: string): SecurityResource[] => {
  return getAllResources().filter(resource =>
    resource.relatedTools?.includes(toolId)
  );
};

// Search resources
export const searchResources = (query: string): SecurityResource[] => {
  const lowerQuery = query.toLowerCase();
  return getAllResources().filter(resource =>
    resource.name.toLowerCase().includes(lowerQuery) ||
    resource.description.toLowerCase().includes(lowerQuery) ||
    resource.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
};
