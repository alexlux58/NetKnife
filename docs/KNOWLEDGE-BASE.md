# NetKnife Knowledge Base, Checklists, and Tool Directory

This document turns the provided Chrome bookmarks into a structured knowledge base, red/blue team checklists, and a deduplicated tool directory. YouTube links are intentionally excluded from the tool directory. Tokenized links or links containing personal tokens are excluded for safety.

## Knowledge Base Structure (technical outline)

### 1) Program & Policy Hygiene
- **Scope definition**: confirm target ownership, authorized assets, and out-of-scope systems; track asset changes over time.
- **Disclosure expectations**: required report format, timelines, safe-harbor language, and coordinated disclosure guidance.
- **Rating/impact models**: map findings to CVSS or vendor taxonomies and justify impact with measurable security outcomes.
- **Operational setup**: account aliases, API key configuration, and platform preferences.

### 2) Recon & Asset Discovery
- **DNS & subdomain discovery**: identify subdomains, track historical records, and validate ownership.
- **Certificate transparency**: enumerate certs issued for target domains and discover new subdomains.
- **Internet exposure**: query device search engines and scan indices for externally visible services.
- **Archive intelligence**: use web archives for historical endpoints and leaked paths.

### 3) Web & API Security Testing
- **Authentication & session**: token handling, cookie flags, MFA/2FA policies.
- **Input validation**: injection vectors (SQL/NoSQL/command), file upload, SSRF, deserialization.
- **Access control**: IDOR/BOLA checks, privilege escalation, horizontal/vertical auth.
- **Headers & CSP**: validate security headers and evaluate CSP effectiveness.
- **CORS & CSRF**: test misconfigurations and unsafe origins.

### 4) Cloud & Infrastructure Security
- **IP/ASN intelligence**: validate ownership and hosting details; cross-check geolocation and abuse data.
- **Configuration reviews**: bucket misconfigurations, exposed services, and leaked secrets.
- **Remote tooling hygiene**: reduce noise, avoid aggressive scanning, and respect target rate limits.

### 5) Malware & Threat Intelligence
- **Sample triage**: hash lookup, sandboxing, and static analysis.
- **Threat hunting**: ATT&CK technique mapping, IOC enrichment, and adversary profiling.
- **Signature development**: YARA rules and heuristic indicators.

### 6) Reporting & Remediation
- **Exploitability**: clear reproduction steps, affected assets, and exploit path.
- **Business impact**: mapping to data exposure, financial impact, or trust damage.
- **Mitigations**: short-term compensating controls and long-term fixes.

### 7) Learning & Labs
- **Focused labs**: path-based learning for web, AD, malware, and forensics.
- **Checklists & guides**: OWASP testing checklist and methodology references.

## Red Team Checklist (high-level, technically detailed)

### Phase 0 — Scoping & OpSec
- [ ] Confirm authorized scope, time window, and rules of engagement.
- [ ] Establish safe-harbor constraints and reporting format.
- [ ] Prepare tooling profiles (low/noise, rate-limited).
- [ ] Define data handling rules (PII, tokens, secrets).

### Phase 1 — Recon & Enumeration
- [ ] Identify apex domains and ASN ranges.
- [ ] Enumerate subdomains (passive + CT logs).
- [ ] Map exposed services via public indices.
- [ ] Gather historical endpoints via web archives.
- [ ] Capture application headers and CSP posture.

### Phase 2 — Vulnerability Discovery
- [ ] Authentication and authorization tests (BOLA/IDOR, role boundary).
- [ ] Input validation: SQL/NoSQL/command injection, SSRF, LFI/RFI.
- [ ] File upload handling: content-type, extension filters, storage location.
- [ ] Cryptographic misuse: weak hashing, JWT validation errors, key misuse.
- [ ] Client-side: DOM XSS, CSP bypass, third-party script risk.

### Phase 3 — Exploitation & Impact Validation
- [ ] Validate severity with concrete impact (data access, RCE, privilege escalation).
- [ ] Collect minimal proof of exploit, avoid full data extraction.
- [ ] Map to CVSS or program-specific taxonomy.

### Phase 4 — Post-Exploitation (within scope)
- [ ] Verify privilege boundaries (least-privilege bypass).
- [ ] Document lateral movement possibilities (only if explicitly authorized).
- [ ] Identify persistence risks (access keys, tokens, sessions).

### Phase 5 — Reporting
- [ ] Include steps to reproduce, expected vs actual, and full impact.
- [ ] Provide fix guidance and recommended controls.
- [ ] Attach logs, screenshots, and minimal exploit evidence.

## Blue Team Checklist (high-level, technically detailed)

### Phase 0 — Readiness
- [ ] Asset inventory and ownership mapping.
- [ ] Security header baselines (CSP, HSTS, XFO, XCTO, Referrer-Policy).
- [ ] Centralized logging (auth, API access, admin events).
- [ ] Threat intel feeds and IOC enrichment sources.

### Phase 1 — Detection Engineering
- [ ] Baselines for auth anomalies (impossible travel, token reuse).
- [ ] Web app telemetry: high-error endpoints, bursty 4xx/5xx.
- [ ] DNS monitoring for anomalous subdomain creation.
- [ ] External attack surface monitoring and certificate issuance alerts.

### Phase 2 — Vulnerability Management
- [ ] Prioritize by exploitability and exposure.
- [ ] Track patch SLAs and exceptions.
- [ ] Verify remediation with regression tests.

### Phase 3 — Incident Response
- [ ] Triage: scope, containment, and preservation of evidence.
- [ ] Acquire artifacts (web logs, endpoint logs, IAM audit trails).
- [ ] IOC enrichment and pivoting using external intel sources.
- [ ] Post-incident hardening and detection updates.

### Phase 4 — Recovery & Lessons Learned
- [ ] Re-issue credentials and rotate secrets.
- [ ] Validate WAF/IDS/IPS rules and detection gaps.
- [ ] Update runbooks and response playbooks.

## Implementation Plan (NetKnife integration)

### Goal
Create a first-class knowledge base + checklist area inside NetKnife, with a curated tool directory that can be referenced by in-app tools.

### Plan
1. **Data structure (docs first)**
   - Keep this markdown as the source of truth.
   - Add a `docs/KNOWLEDGE-BASE.md` link in the README for discoverability.
2. **Information architecture (future UI)**
   - Create a dedicated “Knowledge Base” route (e.g., `/tools/knowledge-base`).
   - Render the checklist sections with checkboxes and progress state (local-only).
3. **Tool directory integration**
   - Model tool entries as a JSON file (`frontend/src/data/tool-directory.json`) with category + URL + tags.
   - Add a “Tool Directory” panel with search, filters, and tags.
4. **Cross-linking with tools**
   - Link NetKnife tools (e.g., Headers Scanner, CSP tools) to relevant knowledge-base sections.
   - Add “Related tools” panels in the Knowledge Base view.

## Tool Directory (non-YouTube)

### Bug Bounty Platforms & Policies
- https://dashboard.redoxengine.com/#/organization/16944
- https://hackerone.com/redox_bbp?view_policy=true
- https://hackerone.com/redox_bbp/policy_scopes
- https://hackerone.com/bug-bounty-programs
- https://hackerone.com/settings/profile/edit
- https://docs.hackerone.com/en/articles/8404308-hacker-email-alias#multiple-aliases
- https://api.hackerone.com/
- https://www.bugcrowd.com/
- https://bugcrowd.com/programs
- https://bugcrowd.com/welcome
- https://bugcrowd.com/vulnerability-rating-taxonomy
- https://www.bugcrowd.com/glossary/vulnerability-disclosure-program-vdp/#:~:text=Vulnerability%20disclosure%20programs%20enable%20users,risk%20associated%20with%20exploiting%20vulnerabilities.
- https://docs.bugcrowd.com/researchers/onboarding/welcome/
- https://docs.bugcrowd.com/api/getting-started/
- https://bugcrowd.com/clickhouse
- https://bugcrowd.com/mastercard
- https://bugcrowd.com/tesla
- https://bugcrowd.com/immutable-og
- https://bugcrowd.com/openai
- https://app.intigriti.com/researcher/dashboard
- https://www.synack.com/
- https://huntr.dev/
- https://zerodium.com/
- https://www.zerodayinitiative.com/
- https://pentestreports.com/
- https://pentestreports.com/reports/
- https://pentester.land/writeups/
- https://github.com/devanshbatham/Awesome-Bugbounty-Writeups

### Vulnerability Databases & Taxonomies
- https://www.cve.org/
- https://cve.mitre.org/
- https://www.cvedetails.com/
- https://www.cvedetails.com/cve/CVE-2019-16511/
- https://www.first.org/cvss/calculator/3.0
- https://www.exploit-db.com/
- https://www.exploit-db.com/search
- https://www.exploit-db.com/exploits/23081
- https://www.exploit-db.com/google-hacking-database
- https://attack.mitre.org/
- https://car.mitre.org/
- https://mitre-engenuity.org/
- https://engage.mitre.org/
- https://engage.mitre.org/starter-kit/
- https://mitre-attack.github.io/attack-navigator/

### Recon, Asset Discovery, & Internet Exposure
- https://www.shodan.io/dashboard
- https://search.censys.io/
- https://leakix.net/
- https://publicwww.com/
- https://www.wappalyzer.com/
- https://archive.org/web/
- https://crt.sh/
- https://ui.ctsearch.entrust.com/ui/ctsearchui
- https://dnsdumpster.com/
- https://viewdns.info/
- https://web-check.xyz/
- https://buckets.grayhatwarfare.com/
- https://en.fofa.info/
- https://viz.greynoise.io/
- https://www.abuseipdb.com/
- https://ipinfo.io/
- https://ipinfo.io/8.8.8.8#block-abuse
- https://bgp.he.net/
- https://he.net/
- https://www.arin.net/
- https://www.dnsleaktest.com/
- https://urlscan.io/

### Web & API Security Tooling
- https://portswigger.net/burp/pro
- https://portswigger.net/web-security/all-labs
- https://portswigger.net/web-security/certification/how-to-prepare
- https://portswigger.net/web-security/certification/how-to-prepare/practitioner-labs-prep-step-one
- https://content-security-policy.com/#directive
- https://csp-evaluator.withgoogle.com/
- https://securityheaders.com/?q=https%3A%2F%2Fcitruslink.tangerineglobal.com%2F&followRedirects=on
- https://report-uri.com/home/generate
- https://jwt.io/
- https://pythex.org/
- https://github.com/zigoo0/JSONBee
- https://beeceptor.com/
- https://pipedream.com/requestbin
- https://imagetragick.com/

### Scanning, Enumeration, & Exploitation Frameworks
- https://github.com/projectdiscovery/subfinder
- https://github.com/CyberLegionLtd/nuclei
- https://github.com/sullo/nikto
- https://github.com/OJ/gobuster
- https://github.com/ffuf/ffuf
- https://github.com/darkoperator/dnsrecon
- https://github.com/aboul3la/Sublist3r
- https://docs.metasploit.com/
- https://www.metasploit.com/
- https://www.infosecmatter.com/metasploit-module-library/?mm=auxiliary/scanner/portscan/ftpbounce
- https://www.rapid7.com/blog/post/2014/01/09/piercing-saprouter-with-metasploit/
- https://nmap.org/nsedoc/scripts/mysql-enum.html
- https://www.openvas.org/

### Credentialing, Passwords, & Cracking
- https://hashcat.net/wiki/doku.php?id=example_hashes
- https://crackstation.net/
- https://hashes.com/en/tools/hash_identifier
- https://www.kali.org/tools/hydra/
- https://github.com/vanhauser-thc/thc-hydra
- https://github.com/danielmiessler/SecLists
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### OSINT, People & Company Research
- https://intelx.io/signup
- https://www.whitepages.com/?is_sem=true&utm_source=google&utm_medium=cpc&utm_campaign=228468457&utm_term=whitepages&sem_account_id=1432223903&sem_campaign_id=228468457&sem_ad_group_id=9601177297&sem_device_type=c&sem_target_id=aud-528449429024:kwd-12145051&sem_keyword=whitepages&sem_matchtype=e&sem_network=g&sem_location_id=9031187&sem_placement=&sem_placement_category=&sem_ad_id=564234077472&sem_ad_tag=&sem_lob=BR_HEAD&sem_path=default&gclid=CjwKCAiAmJGgBhAZEiwA1JZolp0xvARquZ7cpR3zmwFCOjGUegipPeS8QrlkmwjHarYSWewM29H1khoCBm4QAvD_BwE
- https://www.fastpeoplesearch.com/
- https://snov.io/
- https://www.zoominfo.com/
- https://theorg.com/home
- https://opencorporates.com/
- https://www.corporationwiki.com/
- https://www.whoxy.com/
- https://cage.report/
- https://apps.irs.gov/app/eos
- https://trademarks.justia.com/search?q=
- https://www.uspto.gov/trademarks/search
- https://www.federalpay.org/paycheck-protection-program
- https://projects.propublica.org/coronavirus/bailouts/
- https://offshoreleaks.icij.org/
- https://aleph.occrp.org/
- https://www.judyrecords.com/
- https://www.courtlistener.com/recap/
- https://www.google.com/search?q=site%3Ahttps%3A%2F%2Ftheorg.com+TESLA
- https://www.openstreetmap.org/#map=5/38.01/-95.84
- https://yandex.com/
- https://tineye.com/
- https://somerandomstuff1.wordpress.com/2019/02/08/geoguessr-the-top-tips-tricks-and-techniques/
- https://github.com/search

### Email, Phishing, and Messaging Analysis
- https://help.dreamhost.com/hc/en-us/articles/215612887-Email-client-protocols-and-port-numbers
- https://knowledge.validity.com/hc/en-us/articles/220567127-What-are-X-headers-
- https://mediatemple.zendesk.com/hc/en-us/articles/204643950-understanding-an-email-header
- https://toolbox.googleapps.com/apps/messageheader/analyzeheader
- https://mha.azurewebsites.net/
- https://mailheader.org/
- https://gchq.github.io/CyberChef/
- https://www.phishtool.com/
- https://www.theverge.com/22288190/email-pixel-trackers-how-to-stop-images-automatic-download
- https://dmarcian.com/what-is-spf/
- https://dmarcian.com/spf-syntax-table/
- https://dmarcian.com/what-is-the-difference-between-spf-all-and-all/
- https://dmarcian.com/spf-survey/
- https://emailrep.io/success
- https://breachdirectory.org/
- https://haveibeenpwned.com/
- https://hunter.io/
- https://hunter.io/dashboard
- https://hunter.io/api-keys
- https://app.numlookupapi.com/dashboard
- https://www.ipqualityscore.com/user/registration/completed
- https://www.mailinator.com/v4/public/inboxes.jsp?to=alexlux58

### Malware Analysis & Threat Intelligence
- https://bazaar.abuse.ch/
- https://malshare.com/
- https://www.joesecurity.org/
- https://www.hybrid-analysis.com/
- https://app.any.run/
- https://cuckoosandbox.org/
- https://valhalla.nextron-systems.com/
- https://beta.virusbay.io/sample/browse
- https://www.virustotal.com/gui/home/upload
- https://www.virustotal.com/graph/g8a8c71844d5444f98fd3ef10e3ccc94f894c32f05f86417cb4c7605cdc8a2308
- https://www.reversinglabs.com/
- https://malapi.io/
- https://yara.readthedocs.io/en/stable/writingrules.html
- https://www.mandiant.com/resources/insights/apt-groups
- https://logz.io/blog/open-source-threat-intelligence-feeds/
- https://www.honeynet.org/
- https://www.malware-traffic-analysis.net/
- https://www.malware-traffic-analysis.net/training-exercises.html
- https://remnux.org/

### Reverse Engineering & Binary Analysis
- https://hexed.it/
- https://www.dcode.fr/frequency-analysis
- https://www.quipqiup.com/
- https://csrc.nist.gov/pubs/fips/197/final
- https://www.openssl.org/
- https://gnupg.org/
- https://pgptool.org/
- https://pinvoke.net/default.aspx/winmm.midiConnect
- https://www.delphibasics.info/home/delphibasicsarticles/anin-depthlookintothewin32portableexecutablefileformat-part1
- https://www.delphibasics.info/home/delphibasicsarticles/anin-depthlookintothewin32portableexecutablefileformat-part2
- https://wiki.recessim.com/view/Main_Page
- https://lwn.net/Kernel/LDD3/
- https://github.com/martinezjavier/ldd3
- https://www.oreilly.com/library/view/linux-device-drivers/0596000081/ch02s03.html
- https://github.com/torvalds/linux

### Firmware & Hardware
- https://github.com/ReFirmLabs/binwalk/blob/master/INSTALL.md
- https://github.com/ReFirmLabs/binwalk/tree/master
- https://github.com/Sq00ky/Dumping-Router-Firmware-Image/
- https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers?tab=downloads
- http://192.168.4.1/omg.html.gz
- https://o.mg.lol/setup/OMGCable/
- https://o-mg.github.io/WebFlasher/
- https://shop.hak5.org/
- https://payloadstudio.hak5.org/community/
- https://docs.hak5.org/hak5-docs/
- https://hackaday.io/project/162434/gallery#539cb0199de39cf579dc6e30935759d8

### Network Protocols & Scripting
- https://scapy.readthedocs.io/en/latest/introduction.html
- https://docs.pwntools.com/en/stable/
- https://centralops.net/co/
- https://www.sshaudit.com/
- https://softfamous.com/xarp/
- https://www.hypasec.com/
- https://www.vulnhub.com/
- https://gtfobins.github.io/

### Adversary Emulation & Red Team Tooling
- https://github.com/malwaredllc/byob
- https://github.com/PowerShellMafia/PowerSploit/
- https://github.com/PowerShellMafia/PowerSploit/blob/master/Privesc/PowerUp.ps1
- https://github.com/GhostPack/Rubeus
- https://github.com/samratashok/nishang
- https://github.com/DanMcInerney/dnsspoof
- https://github.com/BishopFox/sliver
- https://help.evilginx.com/docs/intro
- https://www.blackhatrussia.com/504-jps-virus-maker.html

### Wordlists & Payload References
- https://github.com/Cryilllic/Active-Directory-Wordlists/blob/master/User.txt
- https://github.com/Cryilllic/Active-Directory-Wordlists/blob/master/Pass.txt
- https://github.com/payloadbox/command-injection-payload-list
- https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Methodology%20and%20Resources/Reverse%20Shell%20Cheatsheet.md
- https://pentestmonkey.net/category/cheat-sheet
- https://web.archive.org/web/20200901140719/http://pentestmonkey.net/cheat-sheet/shells/reverse-shell-cheat-sheet
- http://www.xssgame.com/
- https://wiki.owasp.org/index.php/OWASP_favicon_database
- https://en.wikipedia.org/wiki/Google_hacking
- https://github.com/wisec/OWASP-Testing-Guide-v5/blob/master/checklist/OWASP-Testing_Checklist.xlsx

### Email & Phishing Tooling
- https://github.com/BiZken/PhishMailer
- https://github.com/mandatoryprogrammer/xsshunter-express
- https://grabify.link/
- https://api.github.com/repos/gophish/gophish/commits

### OSINT & Data Enrichment Tools
- https://dehashed.com/
- https://www.dehashed.com/
- https://talosintelligence.com/
- https://talosintelligence.com/reputation
- https://talosintelligence.com/talos_file_reputation
- https://www.abuseipdb.com/
- https://www.chainalysis.com/chainalysis-reactor/#:~:text=Reactor%20is%20the%20investigation%20software,flash%20loans%20and%20NFT%20transfers.
- https://cybermap.kaspersky.com/
- https://emailrep.io/success

### Security Platforms & Training
- https://pentesterlab.com/
- https://www.apisecuniversity.com/
- https://www.apisecuniversity.com/#courses
- https://tryhackme.com/paths
- https://tryhackme.com/path/outline/blueteam
- https://tryhackme.com/path/outline/security-engineer-training
- https://tryhackme.com/hacktivities?tab=search&page=1&free=all&order=most-popular&difficulty=all&type=all&searchTxt=active+directory
- https://portswigger.net/web-security/all-labs
- https://www.sans.org/information-security-policy/
- https://pauljerimy.com/security-certification-roadmap/
- https://www.antisyphontraining.com/pay-what-you-can/
- https://www.splunk.com/en_us/training/certification.html
- https://learn.microsoft.com/en-us/certifications/browse/?roles=security-engineer
- https://hackersploit.org/
- https://zsecurity.org/download-custom-kali/
- https://resources.infosecinstitute.com/topics/penetration-testing/19-extensions-to-turn-google-chrome-into-penetration-testing-tool/
- https://powershell.org/
- https://payatu.com/blog/a-guide-to-linux-privilege-escalation/
- https://ericzimmerman.github.io/#!index.md
- https://sourceforge.net/projects/metasploitable/

### Security Products & Suites
- https://www.splunk.com/en_us/download/splunk-enterprise.html?locale=en_us
- https://docs.splunk.com/Documentation
- https://www.xplg.com/windows-server-security-events-list/
- https://snyk.io/
- https://www.maltego.com/
- https://www.maltego.com/downloads/

### Miscellaneous Utilities
- https://www.convertcsv.com/url-extractor.htm
- https://geocode.xyz/
- https://www.base64decode.org/
- https://exifdata.com/
- https://linangdata.com/exif-reader/
- https://obsidian.md/
- https://lucid.app/documents#/documents?folder_id=recent
- https://2fa.directory/us/
- https://canarytokens.org/generate
- https://www.stationx.net/canarytokens/
- https://www.lifewire.com/hdderase-review-2619137
- https://www.dropbox.com/sh/m6klwzvjrdtpg5f/AADFMi1PJXmpndriRP3Xikila?dl=0
- https://www.riskinsight-wavestone.com/en/2020/01/taking-over-windows-workstations-pxe-laps/
- https://www.leagueoflegends.com/en-pl/news/dev/dev-null-anti-cheat-kernel-driver/
- https://www.splunk.com/en_us/download/splunk-enterprise.html?locale=en_us
- https://www.vx-underground.org/archive.html
- https://prorat.software.informer.com/download/
- https://securityheaders.com/?q=https%3A%2F%2Fcitruslink.tangerineglobal.com%2F&followRedirects=on
- chrome://flags/#allow-insecure-localhost

### Training Labs (TryHackMe)
- https://tryhackme.com/room/nahamsecsudemylabs
- https://tryhackme.com/room/malmalintroductory
- https://tryhackme.com/room/networkservices2
- https://tryhackme.com/room/powershell
- https://tryhackme.com/room/powershellforpentesters
- https://tryhackme.com/room/zer0logon
- https://tryhackme.com/module/basic-computer-exploitation
- https://tryhackme.com/room/vulnversity
- https://tryhackme.com/room/attackingkerberos
- https://tryhackme.com/room/breachingad
- https://tryhackme.com/jr/adenumeration
- https://tryhackme.com/room/enterprise
- https://tryhackme.com/room/exploitingad
- https://tryhackme.com/module/hacking-active-directory
- https://tryhackme.com/room/kenobi
- https://tryhackme.com/room/postexploit
- https://tryhackme.com/room/raz0rblack
- https://tryhackme.com/room/introtocontainerisation
- https://tryhackme.com/room/thegreatescape
- https://tryhackme.com/room/dockerrodeo
- https://tryhackme.com/room/forbusinessreasons
- https://tryhackme.com/room/dissectingpeheaders
- https://tryhackme.com/room/win64assembly
- https://tryhackme.com/room/rfirmware
- https://tryhackme.com/room/basicmalwarere
- https://tryhackme.com/room/kape
- https://tryhackme.com/room/btautopsye0
- https://tryhackme.com/room/autopsy2ze0
- https://tryhackme.com/module/host-evasions
- https://tryhackme.com/room/metasploitexploitation
- https://tryhackme.com/room/meterpreter
- https://tryhackme.com/module/learn-burp-suite
- https://tryhackme.com/module/metasploit
- https://tryhackme.com/module/nmap
- https://tryhackme.com/module/scripting-for-pentesters
- https://tryhackme.com/room/windowsapi
- https://tryhackme.com/room/runtimedetectionevasion
- https://tryhackme.com/room/introtooffensivesecurity
- https://tryhackme.com/room/sqlilab
- https://tryhackme.com/room/dailybugle
- https://tryhackme.com/room/chillhack
- https://tryhackme.com/room/sqlmap
- https://tryhackme.com/room/marketplace
- https://tryhackme.com/room/m4tr1xexitdenied
- https://tryhackme.com/room/credharvesting
- https://tryhackme.com/room/adcertificatetemplates
- https://tryhackme.com/room/careersincyber
- https://tryhackme.com/room/adenumeration
- https://tryhackme.com/room/lateralmovementandpivoting
- https://tryhackme.com/room/splunk2gcd5
- https://tryhackme.com/room/introtoshells
- https://tryhackme.com/room/pythonbasics
- https://tryhackme.com/room/redteamrecon
- https://tryhackme.com/room/splunk201
- https://tryhackme.com/room/benign
- https://tryhackme.com/room/investigatingwithsplunk
- https://tryhackme.com/room/investigatingwithelk101
- https://tryhackme.com/room/itsybitsy
- https://tryhackme.com/room/posheclipse
- https://tryhackme.com/room/uploadvulns
- https://tryhackme.com/module/windows-fundamentals
- https://tryhackme.com/module/hacking-windows-1
- https://tryhackme.com/room/linuxprivesc
- https://tryhackme.com/room/windowsforensics2
- https://tryhackme.com/room/windowsforensics1
- https://tryhackme.com/room/steelmountain
- https://tryhackme.com/room/linuxserverforensics
- https://tryhackme.com/room/protocolsandservers2
- https://tryhackme.com/room/csp
- https://tryhackme.com/room/alfred
- https://tryhackme.com/module/linux-fundamentals
- https://tryhackme.com/module/phishing
- https://tryhackme.com/room/tickets4
- https://tryhackme.com/room/introtosecurityarchitecture
- https://tryhackme.com/room/extendingyournetwork
- https://tryhackme.com/room/networksecurityprotocols
- https://tryhackme.com/room/cybergovernanceregulation
- https://tryhackme.com/room/introwebapplicationsecurity
- https://tryhackme.com/room/principlesofsecurity
- https://tryhackme.com/room/hololive

### Additional References
- https://www.amazon.com/Cyber-Threat-Intelligence-Martin-Lee/dp/1119861748?crid=274SFPP2TF3AC&keywords=cyber+threat+intelligence+BY+MARTIN+LEE&qid=1699430400&sprefix=cyber+threat+intelligence+by+martin+lee,aps,301&sr=8-1&linkCode=sl1&tag=networkexpe08-20&linkId=aa62345b6f8f13cebe5b6c2988d8328e&language=en_US&ref_=as_li_ss_tl
- https://pcl.uscourts.gov/pcl/index.jsf
- https://att.pentester.com/
- https://pentester.com/#cta
- https://www.cisa.gov/news-events/cybersecurity-advisories?f%5B0%5D=advisory_type%3A95
- https://www.chainalysis.com/chainalysis-reactor/#:~:text=Reactor%20is%20the%20investigation%20software,flash%20loans%20and%20NFT%20transfers.
- https://www.riskinsight-wavestone.com/en/2020/01/taking-over-windows-workstations-pxe-laps/
- https://www.hypasec.com/
- https://www.vx-underground.org/archive.html
- https://www.stationx.net/canarytokens/
- https://www.leagueoflegends.com/en-pl/news/dev/dev-null-anti-cheat-kernel-driver/
- https://www.blackhatrussia.com/504-jps-virus-maker.html
- https://www.convertcsv.com/url-extractor.htm
- https://www.chainalysis.com/chainalysis-reactor/#:~:text=Reactor%20is%20the%20investigation%20software,flash%20loans%20and%20NFT%20transfers.
- https://www.riskinsight-wavestone.com/en/2020/01/taking-over-windows-workstations-pxe-laps/
- https://www.leagueoflegends.com/en-pl/news/dev/dev-null-anti-cheat-kernel-driver/
- https://www.splunk.com/en_us/training/certification.html
- https://learn.microsoft.com/en-us/certifications/browse/?roles=security-engineer
- https://pwnable.kr/
- https://pentesterlab.com/
- https://trickest.io/auth/login?returnUrl=%2F
- https://www.splunk.com/en_us/download/splunk-enterprise.html?locale=en_us
- https://docs.splunk.com/Documentation
- https://www.xplg.com/windows-server-security-events-list/
- https://www.splunk.com/en_us/training/certification.html
