/**
 * ==============================================================================
 * NETKNIFE - COMMAND TEMPLATES TOOL
 * ==============================================================================
 * 
 * A searchable library of network device CLI commands.
 * 
 * FEATURES:
 * - Multi-vendor support (Cisco, Arista, Juniper, Brocade, FortiOS, Linux)
 * - Filter by vendor, feature, task
 * - Variable substitution in templates
 * - Copy commands with one click
 * - Verify and rollback commands
 * 
 * All templates are stored client-side. No network calls required.
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import OutputCard from '../../components/OutputCard'
import { templates, renderTemplate, type CommandTemplate } from './templates'

/**
 * Gets unique values from an array
 */
function unique(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort()
}

export default function CommandTemplatesTool() {
  // Filter state
  const [search, setSearch] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [featureFilter, setFeatureFilter] = useState('')
  const [taskFilter, setTaskFilter] = useState('')
  
  // Selected template and variables
  const [selected, setSelected] = useState<CommandTemplate | null>(templates[0] || null)
  const [variables, setVariables] = useState<Record<string, string>>({})

  // Get unique filter values
  const vendors = useMemo(() => unique(templates.map((t) => t.vendor)), [])
  const features = useMemo(() => unique(templates.map((t) => t.feature)), [])
  const tasks = useMemo(() => unique(templates.map((t) => t.task)), [])

  // Filter templates
  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const searchText = `${t.title} ${t.vendor} ${t.feature} ${t.task}`.toLowerCase()
      if (search && !searchText.includes(search.toLowerCase())) return false
      if (vendorFilter && t.vendor !== vendorFilter) return false
      if (featureFilter && t.feature !== featureFilter) return false
      if (taskFilter && t.task !== taskFilter) return false
      return true
    })
  }, [search, vendorFilter, featureFilter, taskFilter])

  // Render selected template
  const rendered = useMemo(() => {
    if (!selected) return ''
    
    const result = {
      title: selected.title,
      vendor: selected.vendor,
      feature: selected.feature,
      task: selected.task,
      commands: selected.commands.map((c) => renderTemplate(c, variables)),
      verify: selected.verify?.map((c) => renderTemplate(c, variables)) || [],
      rollback: selected.rollback?.map((c) => renderTemplate(c, variables)) || [],
      notes: selected.notes || [],
    }
    
    return JSON.stringify(result, null, 2)
  }, [selected, variables])

  function selectTemplate(t: CommandTemplate) {
    setSelected(t)
    setVariables({})
  }

  function clearFilters() {
    setSearch('')
    setVendorFilter('')
    setFeatureFilter('')
    setTaskFilter('')
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            {templates.length} command templates for network device configuration.
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Left panel: Filters and template list */}
        <div className="space-y-4">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="input"
          />

          {/* Filters */}
          <div className="grid grid-cols-3 gap-2">
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="">All Features</option>
              {features.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="">All Tasks</option>
              {tasks.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Clear filters */}
          {(search || vendorFilter || featureFilter || taskFilter) && (
            <button onClick={clearFilters} className="text-sm text-blue-400 hover:underline">
              Clear filters
            </button>
          )}

          {/* Template list */}
          <div className="card max-h-[400px] overflow-y-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No templates match your filters
              </div>
            ) : (
              <div className="divide-y divide-[#30363d]">
                {filtered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className={`w-full text-left p-3 hover:bg-[#21262d] transition-colors ${
                      selected?.id === t.id ? 'bg-[#21262d]' : ''
                    }`}
                  >
                    <div className="font-medium text-sm">{t.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t.vendor} • {t.feature} • {t.task}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Variable inputs */}
          {selected && selected.inputs.length > 0 && (
            <div className="card p-4 space-y-3">
              <h4 className="font-medium text-sm">Variables</h4>
              {selected.inputs.map((input) => (
                <div key={input.key}>
                  <label className="block text-xs text-gray-400 mb-1">
                    {input.label}
                  </label>
                  <input
                    type="text"
                    value={variables[input.key] || ''}
                    onChange={(e) =>
                      setVariables((v) => ({ ...v, [input.key]: e.target.value }))
                    }
                    placeholder={input.placeholder}
                    className="input text-sm py-1.5 font-mono"
                  />
                </div>
              ))}
              <button
                onClick={() => setVariables({})}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Right panel: Output */}
        <OutputCard title="Rendered Commands" value={rendered} />
      </div>
    </div>
  )
}

