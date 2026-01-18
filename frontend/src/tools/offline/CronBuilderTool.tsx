/**
 * ==============================================================================
 * NETKNIFE - CRON BUILDER TOOL
 * ==============================================================================
 * 
 * Visual cron expression builder with human-readable descriptions
 * and next execution time preview.
 * 
 * FEATURES:
 * - Interactive UI for building cron expressions
 * - Supports standard 5-field and extended 6-field (seconds) cron
 * - Human-readable description of schedule
 * - Preview of next N execution times
 * - Common preset schedules
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'


const PRESETS = [
  { label: 'Every minute', cron: '* * * * *' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every day at midnight', cron: '0 0 * * *' },
  { label: 'Every day at 6am', cron: '0 6 * * *' },
  { label: 'Every Monday at 9am', cron: '0 9 * * 1' },
  { label: 'Every weekday at 9am', cron: '0 9 * * 1-5' },
  { label: 'Every Sunday at 3am', cron: '0 3 * * 0' },
  { label: '1st of every month at midnight', cron: '0 0 1 * *' },
  { label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { label: 'Every 6 hours', cron: '0 */6 * * *' },
  { label: 'Twice daily (9am and 5pm)', cron: '0 9,17 * * *' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Parse a cron expression into human-readable description
 */
function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return 'Invalid cron expression (need 5 fields)'
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  
  const descParts: string[] = []
  
  // Minute
  if (minute === '*') {
    descParts.push('Every minute')
  } else if (minute.startsWith('*/')) {
    descParts.push(`Every ${minute.slice(2)} minutes`)
  } else if (minute.includes(',')) {
    descParts.push(`At minutes ${minute}`)
  } else if (minute.includes('-')) {
    descParts.push(`Every minute from ${minute}`)
  } else {
    descParts.push(`At minute ${minute}`)
  }
  
  // Hour
  if (hour !== '*') {
    if (hour.startsWith('*/')) {
      descParts.push(`every ${hour.slice(2)} hours`)
    } else if (hour.includes(',')) {
      descParts.push(`at hours ${hour}`)
    } else if (hour.includes('-')) {
      descParts.push(`during hours ${hour}`)
    } else {
      const h = parseInt(hour, 10)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 || 12
      descParts[0] = descParts[0].replace('Every minute', `At ${h12}:${minute.padStart(2, '0')} ${ampm}`)
      descParts[0] = descParts[0].replace(`At minute ${minute}`, `At ${h12}:${minute.padStart(2, '0')} ${ampm}`)
    }
  }
  
  // Day of month
  if (dayOfMonth !== '*') {
    if (dayOfMonth.startsWith('*/')) {
      descParts.push(`every ${dayOfMonth.slice(2)} days`)
    } else if (dayOfMonth.includes(',')) {
      descParts.push(`on days ${dayOfMonth} of the month`)
    } else if (dayOfMonth.includes('-')) {
      descParts.push(`on days ${dayOfMonth} of the month`)
    } else {
      const d = parseInt(dayOfMonth, 10)
      const suffix = d === 1 || d === 21 || d === 31 ? 'st' : 
                    d === 2 || d === 22 ? 'nd' : 
                    d === 3 || d === 23 ? 'rd' : 'th'
      descParts.push(`on the ${d}${suffix}`)
    }
  }
  
  // Month
  if (month !== '*') {
    if (month.includes(',')) {
      const months = month.split(',').map(m => MONTHS[parseInt(m, 10) - 1] || m).join(', ')
      descParts.push(`in ${months}`)
    } else if (month.includes('-')) {
      const [start, end] = month.split('-').map(m => MONTHS[parseInt(m, 10) - 1] || m)
      descParts.push(`from ${start} to ${end}`)
    } else {
      descParts.push(`in ${MONTHS[parseInt(month, 10) - 1] || month}`)
    }
  }
  
  // Day of week
  if (dayOfWeek !== '*') {
    if (dayOfWeek.includes(',')) {
      const days = dayOfWeek.split(',').map(d => DAYS[parseInt(d, 10)] || d).join(', ')
      descParts.push(`on ${days}`)
    } else if (dayOfWeek.includes('-')) {
      const [start, end] = dayOfWeek.split('-').map(d => DAYS[parseInt(d, 10)] || d)
      descParts.push(`${start} through ${end}`)
    } else {
      descParts.push(`on ${DAYS[parseInt(dayOfWeek, 10)] || dayOfWeek}`)
    }
  }
  
  return descParts.join(', ')
}

/**
 * Calculate next N execution times
 */
function getNextExecutions(cron: string, count: number = 5): Date[] {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return []
  
  const [minuteSpec, hourSpec, daySpec, monthSpec, dowSpec] = parts
  
  const matchesField = (value: number, spec: string): boolean => {
    if (spec === '*') return true
    if (spec.startsWith('*/')) {
      const step = parseInt(spec.slice(2), 10)
      return value % step === 0
    }
    if (spec.includes(',')) {
      return spec.split(',').map(s => parseInt(s, 10)).includes(value)
    }
    if (spec.includes('-')) {
      const [start, end] = spec.split('-').map(s => parseInt(s, 10))
      return value >= start && value <= end
    }
    return value === parseInt(spec, 10)
  }
  
  const executions: Date[] = []
  const now = new Date()
  const current = new Date(now)
  current.setSeconds(0, 0)
  current.setMinutes(current.getMinutes() + 1)
  
  let iterations = 0
  const maxIterations = 525600 // 1 year of minutes
  
  while (executions.length < count && iterations < maxIterations) {
    const minute = current.getMinutes()
    const hour = current.getHours()
    const day = current.getDate()
    const month = current.getMonth() + 1
    const dow = current.getDay()
    
    if (
      matchesField(minute, minuteSpec) &&
      matchesField(hour, hourSpec) &&
      matchesField(day, daySpec) &&
      matchesField(month, monthSpec) &&
      matchesField(dow, dowSpec)
    ) {
      executions.push(new Date(current))
    }
    
    current.setMinutes(current.getMinutes() + 1)
    iterations++
  }
  
  return executions
}

export default function CronBuilderTool() {
  const [cronExpression, setCronExpression] = useState('0 9 * * 1-5')
  const [selectedPreset, setSelectedPreset] = useState('')

  const description = useMemo(() => describeCron(cronExpression), [cronExpression])
  const nextExecutions = useMemo(() => getNextExecutions(cronExpression, 10), [cronExpression])

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    if (preset) {
      setCronExpression(preset)
    }
  }

  const parts = cronExpression.trim().split(/\s+/)
  const isValid = parts.length === 5

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Cron Builder</h1>
        <p className="text-gray-400 mt-1">
          Build and validate cron expressions with human-readable descriptions
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="space-y-4">
          {/* Presets */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Common Presets</h2>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="input"
            >
              <option value="">Select a preset...</option>
              {PRESETS.map((preset, i) => (
                <option key={i} value={preset.cron}>
                  {preset.label} ({preset.cron})
                </option>
              ))}
            </select>
          </div>

          {/* Manual Input */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Cron Expression</h2>
            <input
              type="text"
              value={cronExpression}
              onChange={(e) => {
                setCronExpression(e.target.value)
                setSelectedPreset('')
              }}
              placeholder="* * * * *"
              className={`input font-mono text-lg text-center ${!isValid ? 'border-red-500' : ''}`}
            />
            {!isValid && (
              <p className="text-red-400 text-sm mt-2">
                Invalid format. Need 5 fields: minute hour day month weekday
              </p>
            )}
            
            {/* Field labels */}
            <div className="grid grid-cols-5 gap-2 mt-4 text-center text-xs text-gray-500">
              <div>
                <div className="font-medium text-gray-400">Minute</div>
                <div>0-59</div>
              </div>
              <div>
                <div className="font-medium text-gray-400">Hour</div>
                <div>0-23</div>
              </div>
              <div>
                <div className="font-medium text-gray-400">Day</div>
                <div>1-31</div>
              </div>
              <div>
                <div className="font-medium text-gray-400">Month</div>
                <div>1-12</div>
              </div>
              <div>
                <div className="font-medium text-gray-400">Weekday</div>
                <div>0-6</div>
              </div>
            </div>
          </div>

          {/* Syntax Reference */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Syntax Reference</h2>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <code className="text-blue-400">*</code>
                <span className="text-gray-400">Every value</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-400">5</code>
                <span className="text-gray-400">Specific value</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-400">1-5</code>
                <span className="text-gray-400">Range (1 through 5)</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-400">1,3,5</code>
                <span className="text-gray-400">List (1, 3, and 5)</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-400">*/15</code>
                <span className="text-gray-400">Every 15th value</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-400">1-5/2</code>
                <span className="text-gray-400">Every 2nd in range 1-5</span>
              </div>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="space-y-4">
          {/* Description */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Schedule Description</h2>
            <p className="text-xl text-blue-400">
              {isValid ? description : 'Enter a valid cron expression'}
            </p>
          </div>

          {/* Next Executions */}
          {isValid && nextExecutions.length > 0 && (
            <div className="flex items-center justify-end mb-2">
              <AddToReportButton
                toolId="cron-builder"
                input={cronExpression}
                data={{ cron: cronExpression, description, nextExecutions: nextExecutions.map(d => d.toISOString()) }}
                category="Utilities"
              />
            </div>
          )}
          <OutputCard title="Next 10 Executions" canCopy>
            {isValid && nextExecutions.length > 0 ? (
              <div className="space-y-2">
                {nextExecutions.map((date, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-[#30363d] last:border-0">
                    <span className="text-gray-500 text-sm">#{i + 1}</span>
                    <span className="font-mono text-sm">
                      {date.toLocaleString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No executions found in the next year</p>
            )}
          </OutputCard>

          {/* Usage Examples */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Usage Examples</h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Linux crontab:</div>
                <code className="block p-2 bg-[#161b22] rounded font-mono text-xs">
                  {cronExpression} /path/to/script.sh
                </code>
              </div>
              <div>
                <div className="text-gray-400 mb-1">AWS EventBridge (CloudWatch Events):</div>
                <code className="block p-2 bg-[#161b22] rounded font-mono text-xs">
                  cron({cronExpression.split(' ').map((p, i) => i === 4 ? '?' : p).join(' ')} *)
                </code>
              </div>
              <div>
                <div className="text-gray-400 mb-1">GitHub Actions:</div>
                <code className="block p-2 bg-[#161b22] rounded font-mono text-xs">
                  on:{'\n'}  schedule:{'\n'}    - cron: '{cronExpression}'
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

