/**
 * NetKnife pricing estimator — interactive plan & lab credit calculator.
 */

import { Link } from 'react-router-dom'
import AddToReportButton from '../../components/AddToReportButton'
import { useToolState } from '../../lib/useToolState'
import {
  estimateNetKnifePricing,
  formatUsd,
  LAB_PACKS,
  PLAN_LIMITS,
  type NetKnifePricingEstimate,
} from './netknifePricingLogic'

function SliderRow({
  label,
  value,
  max,
  onChange,
  hint,
}: {
  label: string
  value: number
  max: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="font-mono text-white">{value.toLocaleString()}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function MeterBar({ used, limit, freeLimit }: { used: number; limit: number; freeLimit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : used > 0 ? 100 : 0
  const overFree = used > freeLimit
  return (
    <div className="h-2 rounded-full bg-[#21262d] overflow-hidden">
      <div
        className={`h-full transition-all ${overFree ? 'bg-amber-500' : 'bg-emerald-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function ResultCard({ estimate }: { estimate: NetKnifePricingEstimate }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`card p-4 ${estimate.recommendedPlan === 'free' ? 'border-emerald-500/50' : ''}`}>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Free</p>
          <p className="text-2xl font-bold">{formatUsd(0)}<span className="text-sm font-normal text-gray-400">/mo</span></p>
          {estimate.recommendedPlan === 'free' && (
            <p className="text-emerald-400 text-sm mt-2">✓ Fits your usage</p>
          )}
        </div>
        <div className={`card p-4 ${estimate.recommendedPlan === 'pro' ? 'border-blue-500/50' : ''}`}>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">API Access (Pro)</p>
          <p className="text-2xl font-bold">{formatUsd(5)}<span className="text-sm font-normal text-gray-400">/mo</span></p>
          {estimate.recommendedPlan === 'pro' && (
            <p className="text-blue-400 text-sm mt-2">✓ Recommended</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#30363d] overflow-hidden">
        <div className="px-4 py-2 bg-[#161b22] text-xs font-medium text-gray-500 uppercase">Usage vs Pro limits</div>
        <div className="px-4 py-3 bg-[#0d1117] space-y-4">
          {(['remote', 'advisor', 'reports'] as const).map((key) => {
            const m = estimate.meters[key]
            const labels = { remote: 'Remote API calls', advisor: 'Advisor messages', reports: 'Report saves' }
            const freeLimits = { remote: PLAN_LIMITS.free.remote, advisor: PLAN_LIMITS.free.advisor, reports: PLAN_LIMITS.free.report_save }
            return (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{labels[key]}</span>
                  <span className="font-mono text-white">{m.used} / {m.limit}</span>
                </div>
                <MeterBar used={m.used} limit={m.limit} freeLimit={freeLimits[key]} />
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-[#30363d] p-4 bg-[#0d1117]">
        <h4 className="text-sm font-semibold text-white mb-3">Estimated monthly cost</h4>
        <div className="space-y-2 text-sm">
          {estimate.subscriptionUsd > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Pro subscription</span>
              <span className="font-mono">{formatUsd(estimate.subscriptionUsd)}</span>
            </div>
          )}
          {estimate.labCreditsUsd > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Lab credit packs</span>
              <span className="font-mono">{formatUsd(estimate.labCreditsUsd)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-[#30363d] font-semibold">
            <span>Total</span>
            <span className="font-mono text-cyan-400">{formatUsd(estimate.totalMonthlyUsd)}</span>
          </div>
        </div>
        {estimate.labPacks.length > 0 && (
          <p className="text-xs text-gray-500 mt-3">
            Suggested packs:{' '}
            {estimate.labPacks.map((p) => `${p.count}× ${p.name} (${formatUsd(p.priceUsd)})`).join(', ')}
          </p>
        )}
        {estimate.proReasons.length > 0 && (
          <p className="text-xs text-amber-400/90 mt-2">
            Pro needed for: {estimate.proReasons.join(', ')}
          </p>
        )}
      </div>

      {estimate.notes.length > 0 && (
        <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
          {estimate.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}

      <Link to="/pricing" className="btn-primary inline-block text-center text-sm py-2 px-4">
        View plans & subscribe
      </Link>
    </div>
  )
}

export default function NetKnifePricingTool() {
  const [state, setState] = useToolState(
    'netknife-pricing',
    { remoteCalls: 50, advisorMessages: 10, reportSaves: 2, labHours: 2 },
  )
  const { remoteCalls, advisorMessages, reportSaves, labHours } = state

  const estimate = estimateNetKnifePricing({
    remoteCalls,
    advisorMessages,
    reportSaves,
    labHoursPerMonth: labHours,
  })

  return (
    <div className="space-y-6">
      <div className="card p-4 text-sm text-gray-400">
        <p>
          Estimate NetKnife monthly cost from expected usage. Browser-only tools are always free.
          Lab packs: {LAB_PACKS.map((p) => `${p.name} ${formatUsd(p.priceUsd)}`).join(' · ')}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5 space-y-6">
          <h3 className="font-semibold text-white">Monthly usage</h3>
          <SliderRow
            label="Remote API calls / month"
            value={remoteCalls}
            max={600}
            onChange={(v) => setState({ remoteCalls: v })}
            hint={`Pro includes ${PLAN_LIMITS.pro.remote}/mo`}
          />
          <SliderRow
            label="Security Advisor messages / month"
            value={advisorMessages}
            max={150}
            onChange={(v) => setState({ advisorMessages: v })}
            hint={`Pro includes ${PLAN_LIMITS.pro.advisor}/mo`}
          />
          <SliderRow
            label="Saved reports / month"
            value={reportSaves}
            max={60}
            onChange={(v) => setState({ reportSaves: v })}
            hint={`Free: ${PLAN_LIMITS.free.report_save} · Pro: ${PLAN_LIMITS.pro.report_save}`}
          />
          <SliderRow
            label="Kali Lab hours / month"
            value={labHours}
            max={40}
            onChange={(v) => setState({ labHours: v })}
            hint="Pro subscription required to launch labs"
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-end">
            <AddToReportButton
              toolId="netknife-pricing"
              input={`remote=${remoteCalls}, advisor=${advisorMessages}, reports=${reportSaves}, lab=${labHours}h`}
              data={estimate}
              category="Utilities"
            />
          </div>
          <ResultCard estimate={estimate} />
        </div>
      </div>
    </div>
  )
}
