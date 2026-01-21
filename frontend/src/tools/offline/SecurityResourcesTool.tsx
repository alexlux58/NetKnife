/**
 * ==============================================================================
 * NETKNIFE - SECURITY RESOURCES DIRECTORY
 * ==============================================================================
 *
 * Curated collection of security tools, platforms, and references.
 *
 * FEATURES:
 * - 190+ categorized security resources
 * - Search by name, description, or tags
 * - Filter by category
 * - Direct links to external resources
 * - Related NetKnife tool suggestions
 *
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import { SECURITY_RESOURCES, searchResources, type ResourceCategory } from './security-resources'

export default function SecurityResourcesTool() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Filter resources based on search and category
  const filteredResources = useMemo(() => {
    let results = SECURITY_RESOURCES

    // Filter by category
    if (selectedCategory !== 'all') {
      results = results.filter(cat => cat.name === selectedCategory)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const searchResults = searchResources(searchQuery)
      results = results.map(category => ({
        ...category,
        resources: category.resources.filter(resource =>
          searchResults.some(sr => sr.url === resource.url)
        )
      })).filter(category => category.resources.length > 0)
    }

    return results
  }, [searchQuery, selectedCategory])

  // Count total resources
  const totalResources = useMemo(() => {
    return filteredResources.reduce((sum, cat) => sum + cat.resources.length, 0)
  }, [filteredResources])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card bg-gradient-to-br from-blue-950/40 to-purple-950/40 border-blue-900/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">📚</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Security Resources Directory</h2>
              <p className="text-blue-300 text-sm">
                Curated collection of 190+ security tools, platforms, and references
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium mb-2">Search Resources</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, description, or tag..."
            className="input"
          />
        </div>

        {/* Category filter */}
        <div>
          <label className="block text-sm font-medium mb-2">Filter by Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input"
          >
            <option value="all">All Categories ({SECURITY_RESOURCES.reduce((sum, cat) => sum + cat.resources.length, 0)} resources)</option>
            {SECURITY_RESOURCES.map(category => (
              <option key={category.name} value={category.name}>
                {category.icon} {category.name} ({category.resources.length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Showing <span className="text-white font-medium">{totalResources}</span> resources
          {searchQuery && <span className="text-gray-500"> matching "{searchQuery}"</span>}
        </p>
        {(searchQuery || selectedCategory !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory('all')
            }}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Resources by category */}
      {filteredResources.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 mb-2">No resources found</p>
          <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredResources.map((category) => (
            <CategorySection key={category.name} category={category} />
          ))}
        </div>
      )}

      {/* Footer info */}
      <div className="card p-4 text-sm text-gray-400">
        <p className="mb-2">
          <strong className="text-gray-300">💡 Tip:</strong> Resources with a NetKnife icon (🔗) are related to tools available in NetKnife.
        </p>
        <p className="text-xs text-gray-500">
          These external resources are provided for educational and research purposes. Always ensure you have proper authorization before using any security tools.
        </p>
      </div>
    </div>
  )
}

// Category section component
function CategorySection({ category }: { category: ResourceCategory }) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="card overflow-hidden">
      {/* Category header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{category.icon}</span>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white">{category.name}</h3>
            <p className="text-sm text-gray-400">{category.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 bg-gray-800/50 px-2 py-1 rounded">
            {category.resources.length} resources
          </span>
          <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Resources list */}
      {isExpanded && (
        <div className="border-t border-gray-800">
          {category.resources.map((resource, index) => (
            <div
              key={resource.url}
              className={`p-4 hover:bg-white/5 transition-colors ${
                index !== category.resources.length - 1 ? 'border-b border-gray-800/50' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Resource name and link */}
                  <div className="flex items-center gap-2 mb-1">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm"
                    >
                      {resource.name} ↗
                    </a>
                    {resource.relatedTools && resource.relatedTools.length > 0 && (
                      <span
                        className="text-green-400 text-xs"
                        title="Related to NetKnife tools"
                      >
                        🔗
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-400 mb-2">{resource.description}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {resource.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 bg-gray-800/50 text-gray-400 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Related tools */}
                  {resource.relatedTools && resource.relatedTools.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      <span className="text-green-400">Related NetKnife tools:</span>{' '}
                      {resource.relatedTools.map((toolId, i) => (
                        <span key={toolId}>
                          {i > 0 && ', '}
                          <span className="text-gray-400 font-mono">{toolId}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Open link button */}
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap flex-shrink-0"
                >
                  Visit →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
