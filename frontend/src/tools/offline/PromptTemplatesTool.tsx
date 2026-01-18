/**
 * ==============================================================================
 * NETKNIFE - PROMPT TEMPLATES TOOL
 * ==============================================================================
 * 
 * Security and network engineering prompt templates for AI assistants and documentation.
 * 
 * FEATURES:
 * - Incident response prompts
 * - Firewall rule requests
 * - Network troubleshooting
 * - Security audit prompts
 * - Documentation templates
 * 
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

const PROMPT_TEMPLATES = {
  'Incident Response': {
    'Security Incident Report': `Security Incident Report Template

Incident ID: [ID]
Date/Time: [Timestamp]
Severity: [Low/Medium/High/Critical]
Status: [Open/Investigating/Contained/Resolved]

Description:
[Describe the incident]

Affected Systems:
[List affected systems, IPs, domains]

Indicators of Compromise (IOCs):
- IP addresses:
- Domains:
- File hashes:
- User accounts:

Timeline:
[Chronological events]

Actions Taken:
[Steps taken to investigate/contain]

Recommendations:
[Remediation steps]`,

    'Incident Triage': `Incident Triage Checklist

1. Initial Assessment
   - What type of incident? (Malware, Data breach, DDoS, etc.)
   - When did it occur?
   - Who reported it?
   - What systems are affected?

2. Containment
   - Is the threat still active?
   - Can affected systems be isolated?
   - Are backups available?

3. Evidence Collection
   - Logs to collect:
   - Network captures:
   - System images:
   - User accounts to review:

4. Communication
   - Stakeholders to notify:
   - External parties (law enforcement, customers):
   - Timeline for updates:`,
  },

  'Network Operations': {
    'Firewall Rule Request': `Firewall Rule Request

Requestor: [Name/Team]
Date: [Date]
Priority: [Low/Medium/High/Emergency]

Source:
- IP/CIDR: 
- Port/Protocol:
- Description:

Destination:
- IP/CIDR:
- Port/Protocol:
- Service:

Justification:
[Business reason for rule]

Duration:
[ ] Permanent
[ ] Temporary (expires: [date])

Approval:
- Manager: [ ]
- Security: [ ]
- Network: [ ]`,

    'Network Troubleshooting': `Network Troubleshooting Template

Issue: [Brief description]
Reported by: [Name]
Date/Time: [Timestamp]

Symptoms:
- [What is not working?]
- [Error messages?]
- [When did it start?]

Affected:
- Users/Systems:
- Network segments:
- Applications:

Troubleshooting Steps:
1. [Step taken]
   Result: [Outcome]

2. [Step taken]
   Result: [Outcome]

Root Cause:
[Identified cause]

Resolution:
[How it was fixed]

Prevention:
[How to prevent recurrence]`,
  },

  'Security Audit': {
    'Vulnerability Assessment': `Vulnerability Assessment Report

Target: [System/Domain/IP]
Date: [Date]
Assessor: [Name]

Scope:
[What was tested]

Methodology:
[Tools and techniques used]

Findings:
1. [Vulnerability]
   - Severity: [Critical/High/Medium/Low]
   - Description:
   - Impact:
   - Recommendation:

2. [Vulnerability]
   [Repeat...]

Summary:
- Critical: [count]
- High: [count]
- Medium: [count]
- Low: [count]`,

    'Security Checklist': `Security Hardening Checklist

System: [Hostname/IP]
OS: [Operating System]
Date: [Date]

[ ] Patches up to date
[ ] Unnecessary services disabled
[ ] Firewall rules configured
[ ] Strong passwords enforced
[ ] SSH key-based auth only
[ ] Logging enabled
[ ] Backup configured
[ ] Antivirus/EDR installed
[ ] File integrity monitoring
[ ] Network segmentation verified
[ ] Access controls reviewed
[ ] Encryption enabled (data at rest)
[ ] Encryption enabled (data in transit)
[ ] Security policies documented`,
  },

  'Documentation': {
    'Change Request': `Change Request Form

Request ID: [ID]
Requestor: [Name]
Date: [Date]
Priority: [Low/Medium/High]

Change Description:
[What needs to be changed]

Reason:
[Why is this change needed]

Impact Assessment:
- Systems affected:
- Users affected:
- Downtime expected:
- Rollback plan:

Implementation Plan:
1. [Step]
2. [Step]
3. [Step]

Testing:
[How will success be verified]

Approval:
- Technical Lead: [ ]
- Security: [ ]
- Management: [ ]`,

    'Post-Incident Review': `Post-Incident Review

Incident: [Reference]
Date: [Date]
Participants: [Names]

What Happened:
[Timeline of events]

What Went Well:
[Positive aspects of response]

What Could Be Improved:
[Areas for improvement]

Action Items:
1. [Action] - Owner: [Name] - Due: [Date]
2. [Action] - Owner: [Name] - Due: [Date]

Lessons Learned:
[Key takeaways]`,
  },
}

export default function PromptTemplatesTool() {
  const [category, setCategory] = useState<string>('')
  const [template, setTemplate] = useState<string>('')
  const [output, setOutput] = useState('')

  function handleCategorySelect(cat: string) {
    setCategory(cat)
    setTemplate('')
    setOutput('')
  }

  function handleTemplateSelect(tmpl: string) {
    setTemplate(tmpl)
    setOutput(tmpl)
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            Prompt templates for security and network operations. All processing is local.
          </span>
        </div>
      </div>

      {/* Category selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Category</label>
        <select
          value={category}
          onChange={(e) => handleCategorySelect(e.target.value)}
          className="input"
        >
          <option value="">Select category...</option>
          {Object.keys(PROMPT_TEMPLATES).map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Template selector */}
      {category && (
        <div>
          <label className="block text-sm font-medium mb-2">Template</label>
          <select
            value={template}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="input"
          >
            <option value="">Select template...</option>
            {Object.entries(PROMPT_TEMPLATES[category as keyof typeof PROMPT_TEMPLATES] || {}).map(([name, content]) => (
              <option key={name} value={content}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Output */}
      {output && (
        <>
          <div className="flex items-center justify-end mb-2">
            <AddToReportButton
              toolId="prompt-templates"
              input={`${category} - ${template}`}
              data={{ category, template, content: output }}
              category="Utilities"
            />
          </div>
          <OutputCard
            title="Template"
            value={output}
            canCopy={true}
          />
        </>
      )}

      {/* Info */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About Prompt Templates</h4>
        <p className="text-gray-400 text-xs mb-2">
          These templates help standardize documentation and communication for:
        </p>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Incident response and reporting</li>
          <li>• Network change requests</li>
          <li>• Security assessments</li>
          <li>• Troubleshooting documentation</li>
          <li>• Post-incident reviews</li>
        </ul>
        <p className="text-gray-400 text-xs mt-3">
          Customize templates by copying and editing them for your organization's needs.
        </p>
      </div>
    </div>
  )
}
