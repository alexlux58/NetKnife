import { Link } from 'react-router-dom'
import { listGuides } from '../../guides/registry'

export default function GuidesOverviewPage() {
  const guides = listGuides()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Guides</h1>
        <p className="text-gray-400 mt-1">
          Step-by-step frameworks with tool workflows. Progress is saved to your account.
        </p>
      </div>

      <div className="mb-4">
        <Link to="/guides/coverage-map" className="btn-secondary text-sm">
          View Coverage Map
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {guides.map((g) => (
          <div key={g.id} className="card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{g.name}</div>
                <div className="text-sm text-gray-400 mt-1">{g.description}</div>
              </div>
              <span className="badge bg-blue-500/20 text-blue-300 flex-shrink-0">{g.category}</span>
            </div>
            <div className="text-xs text-gray-500">
              Frameworks: {g.frameworks.join(' • ')}
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-gray-500">{g.steps.length} step(s)</div>
              <Link
                to={`/guides/${g.id}/${g.steps[0]?.id ?? ''}`}
                className="btn-primary text-sm"
              >
                Open
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

