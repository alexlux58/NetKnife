/**
 * ==============================================================================
 * NETKNIFE - SIDEBAR NAVIGATION
 * ==============================================================================
 * 
 * The sidebar provides:
 * - NetKnife branding
 * - Search/filter for tools
 * - Grouped tool navigation
 * - Visual indication of current tool
 * - OFFLINE/REMOTE badges
 * 
 * FEATURES:
 * - Search filters tools by name and description
 * - Tools are grouped by type (Offline, Remote)
 * - Active tool is highlighted
 * - Badges indicate if tool runs locally or on AWS
 * ==============================================================================
 */

import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { tools } from '../../tools/registry'

export default function Sidebar() {
  // Search query state
  const [searchQuery, setSearchQuery] = useState('')

  // Group and filter tools
  const groupedTools = useMemo(() => {
    // Filter by search query
    const filtered = tools.filter((tool) => {
      const searchText = `${tool.name} ${tool.description ?? ''}`.toLowerCase()
      return searchText.includes(searchQuery.toLowerCase())
    })

    // Group by tool group
    const groups = new Map<string, typeof filtered>()
    for (const tool of filtered) {
      const existing = groups.get(tool.group) || []
      groups.set(tool.group, [...existing, tool])
    }

    return Array.from(groups.entries())
  }, [searchQuery])

  return (
    <aside className="fixed inset-y-0 left-0 w-72 bg-[#161b22] border-r border-[#30363d] hidden md:flex md:flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold">NetKnife</h1>
            <p className="text-xs text-gray-400">Network Tools</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <svg 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Tool groups */}
      <nav className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
        {groupedTools.map(([group, groupTools]) => (
          <div key={group} className="mb-6">
            {/* Group header */}
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {group}
            </h2>

            {/* Tools in group */}
            <div className="space-y-1">
              {groupTools.map((tool) => (
                <NavLink
                  key={tool.id}
                  to={tool.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-[#21262d] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-[#21262d]/50'
                    }`
                  }
                >
                  <span className="truncate">{tool.name}</span>
                  <span className={tool.kind === 'remote' ? 'badge-remote' : 'badge-offline'}>
                    {tool.kind === 'remote' ? 'REMOTE' : 'OFFLINE'}
                  </span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* No results */}
        {groupedTools.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>No tools found</p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-blue-400 hover:underline text-sm mt-2"
            >
              Clear search
            </button>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#30363d] text-xs text-gray-500">
        <p>AWS Region: {import.meta.env.VITE_REGION || 'us-west-2'}</p>
      </div>
    </aside>
  )
}

