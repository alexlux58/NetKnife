import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl font-bold text-gray-600">404</div>
      <h1 className="text-xl font-semibold mt-4">Page not found</h1>
      <p className="text-gray-400 mt-2 max-w-sm">
        The tool or page you’re looking for doesn’t exist or was moved.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Go to NetKnife
      </Link>
    </div>
  )
}
