/**
 * ==============================================================================
 * NETKNIFE - SIDEBAR NAVIGATION
 * ==============================================================================
 */

import { useMemo, useState, useId } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { tools, getCategories, type ToolCategory } from '../../tools/registry'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { useBilling } from '../../lib/BillingContext'
import {
  useToolFavorites,
  useToolRecents,
  useSidebarExpanded,
} from '../../lib/toolNavigation'
import ToolKindBadge from '../../components/ToolKindBadge'
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
  StarFilledIcon,
  StarIcon,
} from '@radix-ui/react-icons'

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

function toolById(id: string) {
  return tools.find((t) => t.id === id)
}

export default function Sidebar({ mobileOpen = false, onClose = () => {} }: SidebarProps) {
  const navId = useId()
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const { canUseRemote } = useBilling()
  const { favorites, toggleFavorite, isFavorite } = useToolFavorites()
  const { recents } = useToolRecents()
  const { expandedCategories, setExpandedCategories } = useSidebarExpanded()
  const [searchQuery, setSearchQuery] = useState('')

  const expandedSet = useMemo(() => new Set(expandedCategories), [expandedCategories])

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

    return getCategories()
      .filter((cat) => grouped.has(cat))
      .map((cat) => [cat, grouped.get(cat)!] as const)
  }, [searchQuery])

  const favoriteTools = useMemo(
    () => favorites.map(toolById).filter(Boolean),
    [favorites]
  )
  const recentTools = useMemo(
    () => recents.map(toolById).filter(Boolean),
    [recents]
  )

  const toggleCategory = (category: ToolCategory) => {
    const next = new Set(expandedSet)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    setExpandedCategories(Array.from(next))
  }

  const isSearching = searchQuery.length > 0

  const renderToolLink = (tool: (typeof tools)[number]) => {
    const locked = tool.kind === 'remote' && !canUseRemote
    const fav = isFavorite(tool.id)

    if (locked) {
      return (
        <Link
          key={tool.id}
          to="/pricing"
          onClick={onClose}
          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition-colors text-[var(--color-text-muted)] hover:text-amber-500 hover:bg-[var(--color-bg-tertiary)]/50 min-h-[44px] sm:min-h-0"
        >
          <span className="truncate">{tool.name}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 flex items-center gap-1">
            <LockClosedIcon className="w-3 h-3" />
            Upgrade
          </span>
        </Link>
      )
    }

    return (
      <div key={tool.id} className="flex items-center gap-0.5 group">
        <NavLink
          to={tool.path}
          onClick={onClose}
          className={({ isActive }) =>
            `flex-1 flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition-colors min-h-[44px] sm:min-h-0 ${
              isActive
                ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-accent-blue)] border-l-2 border-[var(--color-accent-blue)] -ml-[13px] pl-[11px]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50'
            }`
          }
        >
          <span className="truncate">{tool.name}</span>
          <ToolKindBadge kind={tool.kind} />
        </NavLink>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            toggleFavorite(tool.id)
          }}
          className="p-2 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-[var(--color-text-muted)] hover:text-amber-500 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center touch-manipulation"
          aria-label={fav ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`}
        >
          {fav ? (
            <StarFilledIcon className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <StarIcon className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    )
  }

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          aria-hidden
        />
      )}

      <aside
        aria-hidden={isMobile && !mobileOpen}
        className={`
          fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] lg:max-w-none
          bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]
          flex flex-col
          transform transition-transform duration-200 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-4 border-b border-[var(--color-border)] flex-shrink-0 relative">
          <div className="flex items-center gap-3 pr-10">
            <Link to="/" onClick={onClose} className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--color-text-primary)]">NetKnife</h1>
                <p className="text-xs text-[var(--color-text-muted)]">{tools.length} Tools</p>
              </div>
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 p-2 -m-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <Cross2Icon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
              aria-label="Search tools in sidebar"
            />
          </div>
        </div>

        <div className="px-4 pb-2 space-y-1 flex-shrink-0">
          <NavLink
            to="/"
            end
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded text-sm min-h-[44px] sm:min-h-0 ${
                isActive
                  ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-accent-blue)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50'
              }`
            }
          >
            <DesktopIcon className="w-4 h-4" />
            Home
          </NavLink>
          <NavLink
            to="/guides"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded text-sm min-h-[44px] sm:min-h-0 ${
                isActive
                  ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-accent-blue)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50'
              }`
            }
          >
            <ReaderIcon className="w-4 h-4" />
            Guides
          </NavLink>
          <NavLink
            to="/board"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded text-sm min-h-[44px] sm:min-h-0 ${
                isActive
                  ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-accent-blue)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50'
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
              `flex items-center gap-2 px-3 py-2 rounded text-sm min-h-[44px] sm:min-h-0 ${
                isActive
                  ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-accent-blue)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50'
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
              `flex items-center gap-2 px-3 py-2 rounded text-sm min-h-[44px] sm:min-h-0 ${
                isActive
                  ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-accent-blue)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50'
              }`
            }
          >
            <ReaderIcon className="w-4 h-4" />
            Activity
          </NavLink>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin" aria-label="Tools">
          {!isSearching && recentTools.length > 0 && (
            <div className="mb-3 px-1">
              <h2 className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                Recent
              </h2>
              <div className="mt-1 space-y-0.5">
                {recentTools.slice(0, 5).map((tool) => tool && renderToolLink(tool))}
              </div>
            </div>
          )}

          {!isSearching && favoriteTools.length > 0 && (
            <div className="mb-3 px-1">
              <h2 className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] flex items-center gap-1">
                <StarFilledIcon className="w-3 h-3 text-amber-500" />
                Favorites
              </h2>
              <div className="mt-1 space-y-0.5">
                {favoriteTools.map((tool) => tool && renderToolLink(tool))}
              </div>
            </div>
          )}

          {categorizedTools.map(([category, categoryTools]) => {
            const panelId = `${navId}-${category.replace(/\s+/g, '-')}`
            const isExpanded = isSearching || expandedSet.has(category)

            return (
              <div key={category} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50 rounded-md transition-colors min-h-[44px] sm:min-h-0 touch-manipulation"
                >
                  <span className="text-[var(--color-text-muted)]">
                    {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                  </span>
                  <span className="text-[var(--color-accent-blue)]">{categoryIcons[category]}</span>
                  <span className="flex-1 truncate">{category}</span>
                  <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded">
                    {categoryTools.length}
                  </span>
                </button>

                {isExpanded && (
                  <div id={panelId} className="ml-4 mt-1 space-y-0.5 border-l border-[var(--color-border)] pl-3">
                    {categoryTools.map((tool) => renderToolLink(tool))}
                  </div>
                )}
              </div>
            )
          })}

          {categorizedTools.length === 0 && (
            <div className="text-center text-[var(--color-text-muted)] py-8">
              <p>No tools found</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[var(--color-accent-blue)] hover:underline text-sm mt-2 min-h-[44px]"
              >
                Clear search
              </button>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] space-y-1 flex-shrink-0">
          <p>Region: {import.meta.env.VITE_REGION || 'us-west-2'}</p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            LOCAL = Browser only
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            AWS = Data sent to backend
          </p>
        </div>
      </aside>
    </>
  )
}
