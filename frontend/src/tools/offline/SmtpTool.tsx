/**
 * ==============================================================================
 * NETKNIFE - SMTP DIAGNOSTICS TOOL
 * ==============================================================================
 * 
 * Build SMTP diagnostic commands for testing email servers.
 * 
 * FEATURES:
 * - openssl s_client commands for SMTP
 * - STARTTLS testing
 * - Authentication testing
 * - Common SMTP commands
 * 
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

export default function SmtpTool() {
  const [host, setHost] = useState('')
  const [port, setPort] = useState('25')
  const [useTLS, setUseTLS] = useState(false)
  const [useSTARTTLS, setUseSTARTTLS] = useState(false)
  const [testAuth, setTestAuth] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [output, setOutput] = useState('')

  function buildCommand() {
    if (!host) {
      setOutput('Error: Host is required')
      return
    }

    let commands: string[] = []

    if (useTLS || useSTARTTLS) {
      let cmd = `openssl s_client -connect ${host}:${port}`
      if (useSTARTTLS) {
        cmd += ' -starttls smtp'
      }
      if (!useTLS && !useSTARTTLS) {
        cmd += ' -quiet'
      }
      commands.push(cmd)
      commands.push('')
      commands.push('# After connection, you can manually type SMTP commands:')
    } else {
      commands.push(`telnet ${host} ${port}`)
      commands.push(`# or: nc ${host} ${port}`)
      commands.push('')
    }

    commands.push('# SMTP Commands (type these after connecting):')
    commands.push('')
    commands.push('EHLO ' + (host || 'example.com'))
    commands.push('')

    if (testAuth && username && password) {
      commands.push('# Authentication (if server supports AUTH):')
      commands.push('AUTH LOGIN')
      commands.push('# Then paste base64 encoded username and password')
      commands.push(`# Username (base64): ${btoa(username)}`)
      commands.push(`# Password (base64): ${btoa(password)}`)
      commands.push('')
    }

    if (from && to) {
      commands.push('MAIL FROM: <' + from + '>')
      commands.push('RCPT TO: <' + to + '>')
      commands.push('DATA')
      commands.push('From: ' + from)
      commands.push('To: ' + to)
      if (subject) {
        commands.push('Subject: ' + subject)
      }
      commands.push('')
      commands.push('Test email body')
      commands.push('.')
      commands.push('QUIT')
    } else {
      commands.push('# Example email sending:')
      commands.push('MAIL FROM: <sender@example.com>')
      commands.push('RCPT TO: <recipient@example.com>')
      commands.push('DATA')
      commands.push('Subject: Test')
      commands.push('')
      commands.push('Test message')
      commands.push('.')
      commands.push('QUIT')
    }

    setOutput(commands.join('\n'))
  }

  return (
    <div className="space-y-6">
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            Build SMTP diagnostic commands locally. No data is sent to any server.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">SMTP Host <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.example.com"
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
          <p className="text-xs text-gray-400 mt-1">Common: 25 (SMTP), 587 (submission), 465 (SMTPS)</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useTLS"
            checked={useTLS}
            onChange={(e) => {
              setUseTLS(e.target.checked)
              if (e.target.checked) {
                setUseSTARTTLS(false)
                if (port === '25') setPort('465')
              }
            }}
            className="w-4 h-4"
          />
          <label htmlFor="useTLS" className="text-sm">Use TLS (SMTPS on port 465)</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useSTARTTLS"
            checked={useSTARTTLS}
            onChange={(e) => {
              setUseSTARTTLS(e.target.checked)
              if (e.target.checked) {
                setUseTLS(false)
                if (port === '465') setPort('587')
              }
            }}
            className="w-4 h-4"
          />
          <label htmlFor="useSTARTTLS" className="text-sm">Use STARTTLS (port 587)</label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="testAuth"
          checked={testAuth}
          onChange={(e) => setTestAuth(e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="testAuth" className="text-sm">Include authentication test</label>
      </div>

      {testAuth && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@example.com"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
        </div>
      )}

      <div className="card p-4 space-y-3">
        <h4 className="font-medium text-sm">Test Email (optional)</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">From</label>
            <input
              type="email"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="sender@example.com"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Test Email"
            className="input"
          />
        </div>
      </div>

      <button onClick={buildCommand} className="btn-primary">
        Generate SMTP Commands
      </button>

      {output && (
        <>
          <div className="flex items-center justify-end mb-2">
            <AddToReportButton
              toolId="smtp"
              input={`${host}:${port}`}
              data={{ commands: output, host, port, useTLS, useSTARTTLS }}
              category="Network Intelligence"
            />
          </div>
          <OutputCard title="SMTP Diagnostic Commands" value={output} canCopy={true} />
        </>
      )}

      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">SMTP Ports</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• <strong>25:</strong> Standard SMTP (often blocked by ISPs)</li>
          <li>• <strong>587:</strong> Submission port with STARTTLS (recommended)</li>
          <li>• <strong>465:</strong> SMTPS (TLS from start, legacy)</li>
        </ul>
        <h4 className="font-medium mb-2 mt-4">Common SMTP Commands</h4>
        <ul className="text-gray-400 space-y-1 text-xs font-mono">
          <li>• EHLO hostname - Extended hello</li>
          <li>• MAIL FROM: &lt;email&gt; - Set sender</li>
          <li>• RCPT TO: &lt;email&gt; - Add recipient</li>
          <li>• DATA - Start email body</li>
          <li>• . - End email body</li>
          <li>• QUIT - Close connection</li>
        </ul>
      </div>
    </div>
  )
}
