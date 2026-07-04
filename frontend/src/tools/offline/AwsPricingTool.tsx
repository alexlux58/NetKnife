/**
 * AWS monthly cost estimator — template-based infrastructure planning.
 */

import { useMemo } from 'react'
import AddToReportButton from '../../components/AddToReportButton'
import { useToolState } from '../../lib/useToolState'
import {
  AWS_TEMPLATES,
  buildTemplateServices,
  estimateAwsPricing,
  formatUsd,
  hoursPerMonth,
  type AwsServiceInput,
  type AwsTemplateId,
} from './awsPricingLogic'

function ServiceRow({
  service,
  onChange,
}: {
  service: AwsServiceInput
  onChange: (patch: Partial<AwsServiceInput>) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2 border-b border-[#21262d] last:border-0">
      <label className="flex items-center gap-2 min-w-[200px] flex-1">
        <input
          type="checkbox"
          checked={service.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="rounded"
        />
        <span className="text-sm text-gray-300">{service.label}</span>
      </label>
      <input
        type="number"
        min={0}
        step="any"
        value={service.quantity}
        onChange={(e) => onChange({ quantity: Math.max(0, Number(e.target.value) || 0) })}
        className="input w-24 text-sm py-1 font-mono"
      />
      <span className="text-xs text-gray-500 w-16">{service.unit}</span>
      <span className="text-xs text-gray-500 font-mono">@{formatUsd(service.unitPriceUsd)}</span>
    </div>
  )
}

export default function AwsPricingTool() {
  const [state, setState] = useToolState(
    'aws-pricing',
    {
      template: 'netknife-like' as AwsTemplateId,
      hoursPerMonth: hoursPerMonth(),
      services: buildTemplateServices('netknife-like') as AwsServiceInput[],
    },
  )

  const setTemplate = (template: AwsTemplateId) => {
    setState({
      template,
      services: template === 'custom' ? state.services : buildTemplateServices(template),
    })
  }

  const updateService = (id: string, patch: Partial<AwsServiceInput>) => {
    setState({
      template: 'custom',
      services: state.services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })
  }

  const estimate = useMemo(
    () =>
      estimateAwsPricing({
        template: state.template,
        hoursPerMonth: state.hoursPerMonth,
        services: state.services,
      }),
    [state.template, state.hoursPerMonth, state.services],
  )

  return (
    <div className="space-y-6">
      <div className="card p-4 text-sm text-gray-400">
        <p>{estimate.disclaimer}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1 space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-white">Architecture template</h3>
            {AWS_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  state.template === t.id
                    ? 'border-blue-500/50 bg-blue-950/20'
                    : 'border-[#30363d] hover:border-gray-600'
                }`}
              >
                <p className="text-sm font-medium text-white">{t.name}</p>
                <p className="text-xs text-gray-500 mt-1">{t.description}</p>
              </button>
            ))}
          </div>

          <div className="card p-4">
            <label className="block text-sm text-gray-400 mb-2">
              Hours per month (for hourly resources)
            </label>
            <input
              type="number"
              min={1}
              max={744}
              value={state.hoursPerMonth}
              onChange={(e) => setState({ hoursPerMonth: Math.max(1, Number(e.target.value) || 730) })}
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Default ≈ 730 (24×30.4)</p>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="flex justify-end">
            <AddToReportButton
              toolId="aws-pricing"
              input={state.template}
              data={estimate}
              category="Utilities"
            />
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-white mb-3">Line items ({estimate.region})</h3>
            <div className="max-h-[420px] overflow-y-auto">
              {state.services.map((s) => (
                <ServiceRow key={s.id} service={s} onChange={(p) => updateService(s.id, p)} />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-4">
              <h4 className="text-xs uppercase text-gray-500 mb-3">By category</h4>
              <div className="space-y-2">
                {Object.entries(estimate.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, usd]) => (
                    <div key={cat} className="flex justify-between text-sm">
                      <span className="text-gray-400">{cat}</span>
                      <span className="font-mono text-white">{formatUsd(usd)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="card p-4 border-cyan-500/30">
              <h4 className="text-xs uppercase text-gray-500 mb-2">Estimated total</h4>
              <p className="text-3xl font-bold text-cyan-400 font-mono">
                {formatUsd(estimate.totalMonthlyUsd)}
                <span className="text-sm font-normal text-gray-400">/mo</span>
              </p>
              <ul className="mt-4 space-y-1 max-h-48 overflow-y-auto">
                {estimate.lineItems.slice(0, 8).map((item) => (
                  <li key={item.id} className="flex justify-between text-xs text-gray-500">
                    <span className="truncate pr-2">{item.label}</span>
                    <span className="font-mono shrink-0">{formatUsd(item.monthlyUsd)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
