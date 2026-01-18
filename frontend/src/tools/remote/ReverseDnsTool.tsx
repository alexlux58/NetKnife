/**
 * ==============================================================================
 * NETKNIFE - REVERSE DNS (PTR) LOOKUP TOOL
 * ==============================================================================
 * 
 * Look up PTR records for IP addresses to find their hostnames.
 * 
 * Uses AWS Lambda backend with DNS-over-HTTPS for reliable resolution.
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
  ip: z.string()
    .min(1, 'IP address is required')
    .refine(
      (val) => {
        // IPv4 validation
        const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/
        if (ipv4.test(val)) {
          return val.split('.').every(n => Number(n) >= 0 && Number(n) <= 255)
        }
        // Basic IPv6 validation
        const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
        return ipv6.test(val) || val === '::' || val === '::1'
      },
      'Invalid IP address format'
    ),
})

type FormData = z.infer<typeof schema>

export default function ReverseDnsTool() {
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ip: '' },
  })

  const [resultData, setResultData] = useState<any>(null)
  const [inputIp, setInputIp] = useState('')

  async function onSubmit(data: FormData) {
    setLoading(true)
    setInputIp(data.ip)
    try {
      const result = await apiClient.post('/reverse-dns', { ip: data.ip })
      setResultData(result)
      setOutput(JSON.stringify(result, null, 2))
    } catch (e) {
      const errorResult = { error: e instanceof Error ? e.message : 'Request failed' }
      setResultData(errorResult)
      setOutput(JSON.stringify(errorResult, null, 2))
    } finally {
      setLoading(false)
    }
  }

  function loadExample() {
    setValue('ip', '8.8.8.8')
  }

  return (
    <div className="space-y-6">
      {/* Remote indicator */}
      <div className="card bg-blue-950/20 border-blue-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-remote">REMOTE</span>
          <span className="text-sm text-gray-400">
            Query is sent to AWS Lambda for DNS resolution via DoH.
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">IP Address</label>
          <input
            {...register('ip')}
            type="text"
            placeholder="8.8.8.8 or 2001:4860:4860::8888"
            className="input font-mono"
          />
          {errors.ip && (
            <p className="text-red-400 text-sm mt-1">{errors.ip.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Supports IPv4 and IPv6 addresses
          </p>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Looking up...' : 'Lookup PTR'}
          </button>
          <button type="button" onClick={loadExample} className="btn-secondary">
            Example
          </button>
        </div>
      </form>

      {/* Output */}
      {output && resultData && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="reverse-dns"
              input={inputIp}
              data={resultData}
              category="DNS & Domain"
            />
          </div>
          <OutputCard title="PTR Record Result" value={output} />
        </div>
      )}

      {/* Reference */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">Common PTR Records</h4>
        <div className="space-y-1 text-gray-400 text-xs font-mono">
          <div>8.8.8.8 → dns.google</div>
          <div>1.1.1.1 → one.one.one.one</div>
          <div>208.67.222.222 → resolver1.opendns.com</div>
          <div>9.9.9.9 → dns9.quad9.net</div>
        </div>
      </div>
    </div>
  )
}

