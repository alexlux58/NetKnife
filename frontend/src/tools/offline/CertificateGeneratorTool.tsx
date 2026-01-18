/**
 * ==============================================================================
 * NETKNIFE - CERTIFICATE & CSR GENERATOR TOOL
 * ==============================================================================
 * 
 * Generate Certificate Signing Requests (CSR) and self-signed certificates.
 * All operations happen client-side - private keys never leave the browser.
 * 
 * FEATURES:
 * - Generate CSR with custom subject fields
 * - Generate self-signed certificates
 * - Export keys in PEM format
 * - Support for SANs (Subject Alternative Names)
 * 
 * SECURITY:
 * - Uses Web Crypto API for key generation
 * - Private keys never transmitted
 * - All operations in browser memory
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

export default function CertificateGeneratorTool() {
  const [mode, setMode] = useState<'csr' | 'self-signed'>('csr')
  const [commonName, setCommonName] = useState('')
  const [organization, setOrganization] = useState('')
  const [organizationalUnit, setOrganizationalUnit] = useState('')
  const [locality, setLocality] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('US')
  const [email, setEmail] = useState('')
  const [sans, setSans] = useState('')
  const [keySize, setKeySize] = useState('2048')
  const [validityDays, setValidityDays] = useState('365')
  const [output, setOutput] = useState('')
  const [privateKey, setPrivateKey] = useState('')

  async function handleGenerate() {
    setOutput('')
    setPrivateKey('')

    // Validate required fields
    if (!commonName) {
      setOutput('Error: Common Name (CN) is required')
      return
    }

    // TODO: Implement actual certificate/CSR generation
    // This requires a library like @peculiar/x509 or node-forge
    // For now, show structure
    
    const subject = [
      `CN=${commonName}`,
      organization && `O=${organization}`,
      organizationalUnit && `OU=${organizationalUnit}`,
      locality && `L=${locality}`,
      state && `ST=${state}`,
      country && `C=${country}`,
      email && `emailAddress=${email}`,
    ].filter(Boolean).join(', ')

    const sanList = sans.split('\n').filter(s => s.trim()).map(s => s.trim())

    if (mode === 'csr') {
      setOutput(`Certificate Signing Request (CSR) would be generated here.

Subject: ${subject}
${sanList.length > 0 ? `SANs: ${sanList.join(', ')}` : ''}
Key Size: ${keySize} bits

Note: This requires a crypto library like @peculiar/x509 or node-forge.
Install with: npm install @peculiar/x509

Structure:
-----BEGIN CERTIFICATE REQUEST-----
[Base64 encoded CSR]
-----END CERTIFICATE REQUEST-----
`)
    } else {
      setOutput(`Self-signed certificate would be generated here.

Subject: ${subject}
${sanList.length > 0 ? `SANs: ${sanList.join(', ')}` : ''}
Key Size: ${keySize} bits
Validity: ${validityDays} days

Note: This requires a crypto library like @peculiar/x509 or node-forge.
Install with: npm install @peculiar/x509

Structure:
-----BEGIN CERTIFICATE-----
[Base64 encoded certificate]
-----END CERTIFICATE-----
`)
    }

    setPrivateKey(`Private key would be generated here (${keySize} bits RSA).

-----BEGIN PRIVATE KEY-----
[Base64 encoded private key]
-----END PRIVATE KEY-----

⚠️ Keep this private key secure! Never share it or commit it to version control.
`)
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            Certificate generation happens locally. Private keys never leave your browser.
          </span>
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('csr')}
          className={`px-4 py-2 rounded text-sm transition-colors ${
            mode === 'csr'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Generate CSR
        </button>
        <button
          onClick={() => setMode('self-signed')}
          className={`px-4 py-2 rounded text-sm transition-colors ${
            mode === 'self-signed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Self-Signed Certificate
        </button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Common Name (CN) <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={commonName}
            onChange={(e) => setCommonName(e.target.value)}
            placeholder="example.com"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Organization (O)</label>
          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="My Company Inc."
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Organizational Unit (OU)</label>
          <input
            type="text"
            value={organizationalUnit}
            onChange={(e) => setOrganizationalUnit(e.target.value)}
            placeholder="IT Department"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Locality (L)</label>
          <input
            type="text"
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            placeholder="City"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">State/Province (ST)</label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="State"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Country (C)</label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="US"
            maxLength={2}
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Key Size</label>
          <select
            value={keySize}
            onChange={(e) => setKeySize(e.target.value)}
            className="input"
          >
            <option value="2048">2048 bits (RSA)</option>
            <option value="3072">3072 bits (RSA)</option>
            <option value="4096">4096 bits (RSA)</option>
          </select>
        </div>

        {mode === 'self-signed' && (
          <div>
            <label className="block text-sm font-medium mb-2">Validity (days)</label>
            <input
              type="number"
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              min="1"
              max="3650"
              className="input"
            />
          </div>
        )}
      </div>

      {/* SANs */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Subject Alternative Names (SANs) - one per line
        </label>
        <textarea
          value={sans}
          onChange={(e) => setSans(e.target.value)}
          placeholder="www.example.com&#10;api.example.com&#10;*.example.com"
          className="input font-mono text-sm min-h-[100px]"
        />
        <p className="text-xs text-gray-400 mt-1">
          Enter DNS names or IP addresses, one per line
        </p>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        className="btn-primary"
      >
        Generate {mode === 'csr' ? 'CSR' : 'Certificate'}
      </button>

      {/* Output */}
      {output && (
        <>
          {/* Add to Report Button */}
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="certificate-generator"
              input={`${mode}: ${commonName}`}
              data={{ output, privateKey }}
              category="Certificates & TLS"
            />
          </div>
          <OutputCard
            title={mode === 'csr' ? 'Certificate Signing Request' : 'Certificate'}
            value={output}
            canCopy={true}
          />
          {privateKey && (
            <OutputCard
              title="Private Key"
              value={privateKey}
              canCopy={true}
            />
          )}
        </>
      )}

      {/* Info */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About Certificates</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• <strong>CSR:</strong> Send to Certificate Authority (CA) to get a signed certificate</li>
          <li>• <strong>Self-Signed:</strong> For testing/internal use only (not trusted by browsers)</li>
          <li>• <strong>SANs:</strong> Additional names/IPs the certificate is valid for</li>
          <li>• <strong>Private Key:</strong> Keep secure! Required to use the certificate</li>
        </ul>
        <p className="text-amber-400 text-xs mt-3">
          ⚠️ This tool requires a crypto library. Install with: npm install @peculiar/x509
        </p>
      </div>
    </div>
  )
}
