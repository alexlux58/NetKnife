import { Link } from 'react-router-dom'
import {
  ReaderIcon,
  RocketIcon,
  StarFilledIcon,
  ClockIcon,
} from '@radix-ui/react-icons'
import { tools, getCategories, categoryInfo, type ToolCategory } from '../../tools/registry'
import { useToolFavorites, useToolRecents } from '../../lib/toolNavigation'
import ToolKindBadge from '../../components/ToolKindBadge'

function toolById(id: string) {
  return tools.find((t) => t.id === id)
}

function ToolCard({ toolId }: { toolId: string }) {
  const tool = toolById(toolId)
  if (!tool) return null
  return (
    <Link
      to={tool.path}
      className="card p-3 hover:border-[var(--color-accent-blue)] transition-colors min-h-[44px] flex flex-col gap-1"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-[var(--color-text-primary)] truncate">{tool.name}</span>
        <ToolKindBadge kind={tool.kind} />
      </div>
      {tool.description && (
        <span className="text-xs text-[var(--color-text-muted)] truncate-2">{tool.description}</span>
      )}
    </Link>
  )
}

function CategoryCard({ category }: { category: ToolCategory }) {
  const count = tools.filter((t) => t.category === category).length
  const first = tools.find((t) => t.category === category)
  const info = categoryInfo[category]
  return (
    <Link
      to={first?.path ?? '/'}
      className="card p-4 hover:border-[var(--color-accent-blue)] transition-colors"
    >
      <h3 className="font-medium text-[var(--color-text-primary)]">{category}</h3>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{info.description}</p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-2">{count} tools</p>
    </Link>
  )
}

export default function HomePage() {
  const { favorites } = useToolFavorites()
  const { recents } = useToolRecents()

  const favoriteTools = favorites.map(toolById).filter(Boolean)
  const recentTools = recents.map(toolById).filter(Boolean)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">NetKnife</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Network &amp; security tools — {tools.length} utilities in one place.
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          Press{' '}
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-xs font-mono">
            ⌘K
          </kbd>{' '}
          to search all tools.
        </p>
      </header>

      {recentTools.length > 0 && (
        <section aria-labelledby="home-recents">
          <h2 id="home-recents" className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)] mb-3">
            <ClockIcon className="w-5 h-5 text-[var(--color-accent-blue)]" />
            Recently used
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentTools.slice(0, 6).map((t) => (
              <ToolCard key={t!.id} toolId={t!.id} />
            ))}
          </div>
        </section>
      )}

      {favoriteTools.length > 0 && (
        <section aria-labelledby="home-favorites">
          <h2 id="home-favorites" className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)] mb-3">
            <StarFilledIcon className="w-5 h-5 text-amber-500" />
            Favorites
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favoriteTools.map((t) => (
              <ToolCard key={t!.id} toolId={t!.id} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="home-categories">
        <h2 id="home-categories" className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Browse by category
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {getCategories().map((cat) => (
            <CategoryCard key={cat} category={cat} />
          ))}
        </div>
      </section>

      <section aria-labelledby="home-quick-links">
        <h2 id="home-quick-links" className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Quick links
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/guides" className="btn-secondary text-sm">
            <ReaderIcon className="w-4 h-4 mr-2" />
            Guides
          </Link>
          <Link to="/board" className="btn-secondary text-sm">
            Message board
          </Link>
          <Link to="/guides/coverage-map" className="btn-secondary text-sm">
            Coverage map
          </Link>
          <a
            href="https://speed.cloudflare.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-sm"
          >
            <RocketIcon className="w-4 h-4 mr-2" />
            Speed test
          </a>
        </div>
      </section>

      <div className="card p-4 text-sm text-[var(--color-text-secondary)] flex flex-wrap gap-4">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          LOCAL — runs in your browser
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          AWS — data sent to backend
        </span>
      </div>
    </div>
  )
}
