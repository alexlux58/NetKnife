/**
 * ==============================================================================
 * NETKNIFE - GOOGLE DORKS GENERATOR TOOL
 * ==============================================================================
 * 
 * Generate Google search queries (dorks) for security research and self-audit.
 * 
 * FEATURES:
 * - Common dork templates
 * - Custom dork builder
 * - Domain-scoped searches
 * - File type searches
 * 
 * WARNING: Use only for authorized security testing on systems you own or have permission to test.
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

const DORK_TEMPLATES = {
  'File Types': {
    'PDF files': 'filetype:pdf',
    'Excel files': 'filetype:xls OR filetype:xlsx',
    'Word documents': 'filetype:doc OR filetype:docx',
    'PowerPoint': 'filetype:ppt OR filetype:pptx',
    'Text files': 'filetype:txt',
    'CSV files': 'filetype:csv',
    'SQL dumps': 'filetype:sql',
    'Backup files': 'filetype:bak OR filetype:backup',
  },
  'Sensitive Information': {
    'Passwords': 'intext:"password" filetype:txt',
    'API keys': 'intext:"api_key" OR intext:"apikey"',
    'Private keys': 'filetype:key OR filetype:pem',
    'Config files': 'filetype:conf OR filetype:config',
    'Environment files': 'filetype:env',
    'Credentials': 'intext:"username" intext:"password"',
  },
  'Web Technologies': {
    'PHP info': 'inurl:phpinfo.php',
    'Login pages': 'inurl:login OR inurl:signin',
    'Admin panels': 'inurl:admin OR inurl:administrator',
    'Error pages': 'intext:"error" intext:"stack trace"',
    'Directory listings': 'intitle:"index of"',
    'WordPress': 'inurl:wp-admin OR inurl:wp-content',
  },
  'Security': {
    'Open directories': 'intitle:"index of"',
    'Exposed databases': 'inurl:phpmyadmin OR inurl:adminer',
    'Git repositories': 'inurl:.git',
    'SVN repositories': 'inurl:.svn',
    'Exposed S3 buckets': 'inurl:.s3.amazonaws.com',
  },
}

export default function GoogleDorksTool() {
  const [domain, setDomain] = useState('')
  const [selectedDork, setSelectedDork] = useState('')
  const [customQuery, setCustomQuery] = useState('')
  const [output, setOutput] = useState('')

  function buildDork() {
    let query = selectedDork || customQuery

    if (!query) {
      setOutput('Error: Please select a dork template or enter a custom query')
      return
    }

    // Add domain scope if provided
    if (domain) {
      query = `site:${domain} ${query}`
    }

    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    
    setOutput(`Google Dork Query:
${query}

Google Search URL:
${googleUrl}

Command to open:
open "${googleUrl}"

Or copy the query above and paste it into Google Search.`)
  }

  function handleDorkSelect(dork: string) {
    setSelectedDork(dork)
    setCustomQuery('')
  }

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="card bg-amber-950/20 border-amber-900/50">
        <div className="p-4">
          <p className="text-amber-400 text-sm font-medium mb-2">⚠️ Legal and Ethical Use Only</p>
          <p className="text-amber-300 text-xs">
            Use Google dorks only for authorized security testing on systems you own or have explicit permission to test. 
            Unauthorized access to computer systems is illegal. Always obtain proper authorization before conducting security research.
          </p>
        </div>
      </div>

      {/* Domain scope */}
      <div>
        <label className="block text-sm font-medium mb-2">Domain Scope (optional - limits search to specific domain)</label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com (leave empty for global search)"
          className="input"
        />
        <p className="text-xs text-gray-400 mt-1">
          Use this to scope searches to your own domain for self-audit purposes
        </p>
      </div>

      {/* Dork templates */}
      <div>
        <label className="block text-sm font-medium mb-2">Select Dork Template</label>
        <select
          value={selectedDork}
          onChange={(e) => handleDorkSelect(e.target.value)}
          className="input"
        >
          <option value="">Select a template...</option>
          {Object.entries(DORK_TEMPLATES).map(([category, dorks]) => (
            <optgroup key={category} label={category}>
              {Object.entries(dorks).map(([name, dork]) => (
                <option key={dork} value={dork}>
                  {name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Custom query */}
      <div>
        <label className="block text-sm font-medium mb-2">Or Enter Custom Query</label>
        <input
          type="text"
          value={customQuery}
          onChange={(e) => {
            setCustomQuery(e.target.value)
            setSelectedDork('')
          }}
          placeholder='filetype:pdf OR inurl:admin'
          className="input font-mono text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">
          Use Google search operators: filetype:, inurl:, intitle:, intext:, site:, etc.
        </p>
      </div>

      {/* Generate button */}
      <button
        onClick={buildDork}
        className="btn-primary"
      >
        Generate Google Dork
      </button>

      {/* Output */}
      {output && (
        <>
          <div className="flex items-center justify-end mb-2">
            <AddToReportButton
              toolId="google-dorks"
              input={selectedDork || customQuery}
              data={{ query: selectedDork || customQuery, domain, output }}
              category="Threat Intelligence"
            />
          </div>
          <OutputCard
            title="Google Dork"
            value={output}
            canCopy={true}
          />
        </>
      )}

      {/* Reference */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">Google Search Operators</h4>
        <div className="space-y-1 text-xs text-gray-400 font-mono">
          <div><strong className="text-gray-300">site:</strong> Limit to specific domain</div>
          <div><strong className="text-gray-300">filetype:</strong> Search by file extension</div>
          <div><strong className="text-gray-300">inurl:</strong> Search in URL</div>
          <div><strong className="text-gray-300">intitle:</strong> Search in page title</div>
          <div><strong className="text-gray-300">intext:</strong> Search in page content</div>
          <div><strong className="text-gray-300">-</strong> Exclude term (e.g., -example)</div>
          <div><strong className="text-gray-300">"exact phrase"</strong> Exact phrase match</div>
          <div><strong className="text-gray-300">OR</strong> Logical OR</div>
          <div><strong className="text-gray-300">AND</strong> Logical AND (default)</div>
        </div>
      </div>
    </div>
  )
}
