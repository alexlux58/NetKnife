/**
 * ==============================================================================
 * NETKNIFE - ADD TO REPORT BUTTON
 * ==============================================================================
 * 
 * Reusable button component that adds tool results to the current report.
 * Can be used in any tool component.
 * ==============================================================================
 */

import { useState } from 'react'
import { useReport } from '../lib/reportContext'
import { tools } from '../tools/registry'

interface AddToReportButtonProps {
  toolId: string
  input: string
  data: any
  category?: string
  className?: string
}

export default function AddToReportButton({ toolId, input, data, category, className = '' }: AddToReportButtonProps) {
  const { addToReport, currentReport } = useReport()
  const [added, setAdded] = useState(false)

  const tool = tools.find(t => t.id === toolId)
  const toolName = tool?.name || toolId

  function handleAdd() {
    addToReport(toolId, toolName, input, data, category)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const itemCount = currentReport?.items.length || 0

  return (
    <button
      onClick={handleAdd}
      className={`px-3 py-2 sm:py-1.5 text-xs rounded transition-colors min-h-[40px] sm:min-h-0 touch-manipulation ${
        added
          ? 'bg-green-600 text-white'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
      } ${className}`}
      title="Add this result to your report"
    >
      {added ? (
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Added
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add to Report {itemCount > 0 && `(${itemCount})`}
        </span>
      )}
    </button>
  )
}
