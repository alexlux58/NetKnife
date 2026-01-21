import { Link } from 'react-router-dom'

export default function PlaceholderStep() {
  // This component is loaded via GuideLayout and receives step data there.
  // It intentionally renders nothing by default.
  return (
    <div className="card p-4 text-sm text-gray-400">
      This step is defined in the guide registry. Use the step renderer in the guide layout.
      <div className="mt-2">
        <Link to="/guides" className="text-blue-400 hover:underline">Back to Guides</Link>
      </div>
    </div>
  )
}

