/**
 * ==============================================================================
 * NETKNIFE - REMOTE DISCLOSURE COMPONENT
 * ==============================================================================
 * 
 * Displays a notice for remote tools explaining:
 * - That the tool runs from AWS (not locally)
 * - What data is sent to the server
 * - That results reflect AWS vantage point
 * 
 * This is important for transparency and to help users understand
 * that certain tools like ping/traceroute from AWS won't reflect
 * their local network path.
 * 
 * USAGE:
 * ```tsx
 * <RemoteDisclosure
 *   sends={['domain name', 'record type']}
 *   notes="Results cached for 5 minutes"
 * />
 * ```
 * ==============================================================================
 */

interface RemoteDisclosureProps {
  /** List of data items sent to AWS */
  sends: string[]
  /** Optional additional notes */
  notes?: string
}

export default function RemoteDisclosure({ sends, notes }: RemoteDisclosureProps) {
  const region = import.meta.env.VITE_REGION || 'us-west-2'

  return (
    <div className="card border-amber-900/50 bg-amber-950/20">
      <div className="p-3 sm:p-4 space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <span className="font-medium text-amber-400">Remote Tool</span>
          </div>
          <span className="badge-remote">AWS {region}</span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400">
          This tool runs from AWS. Results reflect AWS network vantage point, 
          not your local network path.
        </p>

        {/* Data sent */}
        <div className="text-sm">
          <p className="text-gray-300 font-medium mb-1">Data sent to AWS:</p>
          <ul className="list-disc list-inside text-gray-400 space-y-0.5">
            {sends.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Notes */}
        {notes && (
          <p className="text-xs text-gray-500 border-t border-amber-900/30 pt-3">
            {notes}
          </p>
        )}
      </div>
    </div>
  )
}

