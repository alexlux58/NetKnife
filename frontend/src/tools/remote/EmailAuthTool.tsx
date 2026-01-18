/**
 * ==============================================================================
 * NETKNIFE - EMAIL AUTHENTICATION (SPF/DKIM/DMARC) CHECKER
 * ==============================================================================
 * 
 * Validate email authentication records for a domain.
 * Checks SPF, DKIM, and DMARC configurations with detailed analysis.
 * 
 * Uses AWS Lambda backend with DNS-over-HTTPS.
 * ==============================================================================
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import { apiClient } from '../../lib/api'

const schema = z.object({
  domain: z.string()
    .min(1, 'Domain is required')
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]?\.[a-zA-Z]{2,}/, 'Invalid domain format'),
  dkimSelector: z.string(),
})

type FormData = z.infer<typeof schema>

interface EmailAuthResult {
  domain: string
  score: number
  grade: string
  spf: {
    found: boolean
    record?: string
    all?: string
    warnings?: string[]
  }
  dmarc: {
    found: boolean
    record?: string
    policy?: string
    warnings?: string[]
  }
  dkim: {
    found: boolean
    selector: string
    record?: string
    warnings?: string[]
  }
  cached: boolean
}

export default function EmailAuthTool() {
  const [output, setOutput] = useState('')
  const [result, setResult] = useState<EmailAuthResult | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { domain: '', dkimSelector: 'default' },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    setResult(null)
    try {
      const res = await apiClient.post('/email-auth', data) as EmailAuthResult
      setResult(res)
      setOutput(JSON.stringify(res, null, 2))
    } catch (e) {
      setOutput(JSON.stringify({ error: e instanceof Error ? e.message : 'Request failed' }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  function loadExample() {
    setValue('domain', 'google.com')
    setValue('dkimSelector', 'default')
  }

  const gradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-400'
      case 'B': return 'text-lime-400'
      case 'C': return 'text-yellow-400'
      case 'D': return 'text-orange-400'
      default: return 'text-red-400'
    }
  }

  return (
    <div className="space-y-6">
      {/* Remote indicator */}
      <div className="card bg-blue-950/20 border-blue-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-remote">REMOTE</span>
          <span className="text-sm text-gray-400">
            DNS queries are performed via AWS Lambda using DoH.
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-2">Domain</label>
            <input
              {...register('domain')}
              type="text"
              placeholder="example.com"
              className="input font-mono"
            />
            {errors.domain && (
              <p className="text-red-400 text-sm mt-1">{errors.domain.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">DKIM Selector</label>
            <input
              {...register('dkimSelector')}
              type="text"
              placeholder="default, google, selector1..."
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Common: default, google, selector1, selector2, s1, s2
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Checking...' : 'Check Email Auth'}
          </button>
          <button type="button" onClick={loadExample} className="btn-secondary">
            Example
          </button>
        </div>
      </form>

      {/* Visual Results */}
      {result && (
        <div className="space-y-4">
          {/* Add to Report Button */}
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="email-auth"
              input={result.domain}
              data={result}
              category="Email Security"
            />
          </div>
          {/* Score card */}
          <div className="card p-6 text-center">
            <div className={`text-6xl font-bold ${gradeColor(result.grade)}`}>
              {result.grade}
            </div>
            <div className="text-gray-400 mt-2">
              Score: {result.score}/100
            </div>
          </div>

          {/* Individual checks */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* SPF */}
            <div className={`card p-4 ${result.spf.found ? 'border-green-900/50' : 'border-red-900/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">SPF</h4>
                <span className={result.spf.found ? 'text-green-400' : 'text-red-400'}>
                  {result.spf.found ? '✓' : '✗'}
                </span>
              </div>
              {result.spf.found ? (
                <>
                  <p className="text-xs text-gray-400 font-mono break-all mb-2">
                    {result.spf.record?.substring(0, 60)}...
                  </p>
                  <p className="text-sm">
                    Policy: <span className={
                      result.spf.all === 'fail' ? 'text-green-400' :
                      result.spf.all === 'softfail' ? 'text-yellow-400' :
                      'text-red-400'
                    }>{result.spf.all || 'none'}</span>
                  </p>
                </>
              ) : (
                <p className="text-red-400 text-sm">No SPF record found</p>
              )}
            </div>

            {/* DMARC */}
            <div className={`card p-4 ${result.dmarc.found ? 'border-green-900/50' : 'border-red-900/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">DMARC</h4>
                <span className={result.dmarc.found ? 'text-green-400' : 'text-red-400'}>
                  {result.dmarc.found ? '✓' : '✗'}
                </span>
              </div>
              {result.dmarc.found ? (
                <>
                  <p className="text-sm mb-2">
                    Policy: <span className={
                      result.dmarc.policy === 'reject' ? 'text-green-400' :
                      result.dmarc.policy === 'quarantine' ? 'text-yellow-400' :
                      'text-red-400'
                    }>{result.dmarc.policy}</span>
                  </p>
                </>
              ) : (
                <p className="text-red-400 text-sm">No DMARC record found</p>
              )}
            </div>

            {/* DKIM */}
            <div className={`card p-4 ${result.dkim.found ? 'border-green-900/50' : 'border-amber-900/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">DKIM</h4>
                <span className={result.dkim.found ? 'text-green-400' : 'text-amber-400'}>
                  {result.dkim.found ? '✓' : '?'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                Selector: {result.dkim.selector}
              </p>
              {result.dkim.found ? (
                <p className="text-green-400 text-sm">Record found</p>
              ) : (
                <p className="text-amber-400 text-sm">Not found (try other selectors)</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full output */}
      <OutputCard title="Full Result" value={output} />

      {/* Reference */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">Email Authentication Guide</h4>
        <div className="space-y-2 text-gray-400 text-xs">
          <div><span className="text-blue-400">SPF:</span> Specifies which servers can send email for your domain</div>
          <div><span className="text-blue-400">DKIM:</span> Cryptographically signs emails to verify authenticity</div>
          <div><span className="text-blue-400">DMARC:</span> Tells receivers what to do when SPF/DKIM fail</div>
          <div className="pt-2 border-t border-gray-700">
            <span className="text-green-400">Best practice:</span> SPF with -all, DMARC with p=reject, DKIM configured
          </div>
        </div>
      </div>
    </div>
  )
}

