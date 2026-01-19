/**
 * ==============================================================================
 * NETKNIFE - SIDEBAR NAVIGATION
 * ==============================================================================
 * 
 * Category-based navigation for all NetKnife tools.
 * 
 * FEATURES:
 * - Collapsible categories with smooth animation
 * - Search filters tools by name and description
 * - OFFLINE/REMOTE badges indicate where tool runs
 * - Active tool highlighting
 * - Category icons for visual distinction
 * ==============================================================================
 */

import { useMemo, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { tools, getCategories, type ToolCategory } from '../../tools/registry'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { useBilling } from '../../lib/BillingContext'
import { 
  ChevronDownIcon, 
  ChevronRightIcon,
  Cross2Icon,
  MagnifyingGlassIcon,
  DesktopIcon,
  GlobeIcon,
  LockClosedIcon,
  Share1Icon,
  ExclamationTriangleIcon,
  EnvelopeClosedIcon,
  CodeIcon,
  ReaderIcon,
  ClockIcon,
  FileTextIcon,
  LightningBoltIcon,
} from '@radix-ui/react-icons'

/** Map category names to icons */
const categoryIcons: Record<ToolCategory, React.ReactNode> = {
  'Network Calculators': <DesktopIcon className="w-4 h-4" />,
  'DNS & Domain': <GlobeIcon className="w-4 h-4" />,
  'Certificates & TLS': <LockClosedIcon className="w-4 h-4" />,
  'Network Intelligence': <Share1Icon className="w-4 h-4" />,
  'Threat Intelligence': <ExclamationTriangleIcon className="w-4 h-4" />,
  'Email Security': <EnvelopeClosedIcon className="w-4 h-4" />,
  'Encoding & Crypto': <CodeIcon className="w-4 h-4" />,
  'Reference & Templates': <ReaderIcon className="w-4 h-4" />,
  'Time & Scheduling': <ClockIcon className="w-4 h-4" />,
  'Data & Text': <FileTextIcon className="w-4 h-4" />,
  'Generators': <LightningBoltIcon className="w-4 h-4" />,
  'Utilities': <DesktopIcon className="w-4 h-4" />,
}

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onClose = () => {} }: SidebarProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const { canUseRemote } = useBilling()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<ToolCategory>>(
    new Set(getCategories()) // All expanded by default
  )

  // Group and filter tools by category
  const categorizedTools = useMemo(() => {
    const filtered = tools.filter((tool) => {
      const searchText = `${tool.name} ${tool.description ?? ''}`.toLowerCase()
      return searchText.includes(searchQuery.toLowerCase())
    })

    const grouped = new Map<ToolCategory, typeof filtered>()
    for (const tool of filtered) {
      const existing = grouped.get(tool.category) || []
      grouped.set(tool.category, [...existing, tool])
    }

    // Return categories in order, only if they have matching tools
    return getCategories()
      .filter(cat => grouped.has(cat))
      .map(cat => [cat, grouped.get(cat)!] as const)
  }, [searchQuery])

  const toggleCategory = (category: ToolCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Expand all categories when searching
  const isSearching = searchQuery.length > 0

  return (
    <>
      {/* Backdrop - mobile only when open */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          aria-hidden
        />
      )}

      <aside
        aria-hidden={isMobile && !mobileOpen}
        className={`
          fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:max-w-none
          bg-[#161b22] border-r border-[#30363d]
          flex flex-col
          transform transition-transform duration-200 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex-shrink-0 relative">
          <div className="flex items-center gap-3 pr-10">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold">NetKnife</h1>
            <p className="text-xs text-gray-400">{tools.length} Tools</p>
          </div>
          {/* Close button - mobile only */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 p-2 -m-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <Cross2Icon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Message board */}
      <div className="px-4 pb-2 space-y-1">
        <NavLink
          to="/board"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded text-sm ${
              isActive ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:text-white hover:bg-[#21262d]/50'
            }`
          }
        >
          <EnvelopeClosedIcon className="w-4 h-4" />
          Message board
        </NavLink>
        <NavLink
          to="/alarms"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded text-sm ${
              isActive ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:text-white hover:bg-[#21262d]/50'
            }`
          }
        >
          <ExclamationTriangleIcon className="w-4 h-4" />
          Alarms
        </NavLink>
        <NavLink
          to="/activity"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded text-sm ${
              isActive ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:text-white hover:bg-[#21262d]/50'
            }`
          }
        >
          <ReaderIcon className="w-4 h-4" />
          Activity
        </NavLink>
      </div>

      {/* Categories */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
        {categorizedTools.map(([category, categoryTools]) => {
          const isExpanded = isSearching || expandedCategories.has(category)
          
          return (
            <div key={category} className="mb-1">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-gray-300 hover:text-white hover:bg-[#21262d]/50 rounded-md transition-colors"
              >
                <span className="text-gray-500">
                  {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                </span>
                <span className="text-blue-400">{categoryIcons[category]}</span>
                <span className="flex-1 truncate">{category}</span>
                <span className="text-xs text-gray-500 bg-[#21262d] px-1.5 py-0.5 rounded">
                  {categoryTools.length}
                </span>
              </button>

              {/* Tools in category */}
              {isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-[#30363d] pl-3">
                  {categoryTools.map((tool) => {
                    const locked = tool.kind === 'remote' && !canUseRemote
                    if (locked) {
                      return (
                        <Link
                          key={tool.id}
                          to="/pricing"
                          onClick={onClose}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition-colors text-gray-500 hover:text-amber-400 hover:bg-[#21262d]/50"
                        >
                          <span className="truncate">{tool.name}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
                            <LockClosedIcon className="w-3 h-3" />
                            Upgrade
                          </span>
                        </Link>
                      )
                    }
                    return (
                      <NavLink
                        key={tool.id}
                        to={tool.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                            isActive
                              ? 'bg-blue-500/20 text-blue-300 border-l-2 border-blue-400 -ml-[13px] pl-[11px]'
                              : 'text-gray-400 hover:text-white hover:bg-[#21262d]/50'
                          }`
                        }
                      >
                        <span className="truncate">{tool.name}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          tool.kind === 'remote'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {tool.kind === 'remote' ? 'AWS' : 'LOCAL'}
                        </span>
                      </NavLink>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* No results */}
        {categorizedTools.length === 0 && (
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
      <div className="p-4 border-t border-[#30363d] text-xs text-gray-500 space-y-1">
        <p>Region: {import.meta.env.VITE_REGION || 'us-west-2'}</p>
        <p className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          LOCAL = Browser only
        </p>
        <p className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          AWS = Data sent to backend
        </p>
      </div>
    </aside>
    </>
  )
}
