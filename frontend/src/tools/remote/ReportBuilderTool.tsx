/**
 * ==============================================================================
 * NETKNIFE - REPORT BUILDER
 * ==============================================================================
 * 
 * Tool for managing reports - view, edit, save, and download as PDF.
 * ==============================================================================
 */

import { useState, useEffect } from 'react'
import { useReport, ReportCategory } from '../../lib/reportContext'
import OutputCard from '../../components/OutputCard'
import RemoteDisclosure from '../../components/RemoteDisclosure'

interface SavedReport {
  id: string
  title: string
  category?: ReportCategory
  createdAt: string
  updatedAt: string
}

export default function ReportBuilderTool() {
  const {
    currentReport,
    setCurrentReport,
    saveReport,
    loadReport,
    deleteReport,
    listReports,
    clearReport,
    generatePDF,
  } = useReport()

  const [savedReports, setSavedReports] = useState<SavedReport[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [reportTitle, setReportTitle] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [reportCategory, setReportCategory] = useState<ReportCategory>('general')
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | 'all'>('all')
  const [generatingAI, setGeneratingAI] = useState(false)

  async function loadSavedReports() {
    try {
      const reports = await listReports(selectedCategory === 'all' ? undefined : selectedCategory)
      setSavedReports(reports)
    } catch (e) {
      console.error('Failed to load reports:', e)
    }
  }

  useEffect(() => {
    loadSavedReports()
  }, [selectedCategory])

  async function handleSave() {
    if (!currentReport || currentReport.items.length === 0) {
      setError('No items in report to save')
      return
    }

    setLoading(true)
    setError('')

    try {
      await saveReport(reportTitle || undefined, reportDescription || undefined, reportCategory)
      setShowSaveDialog(false)
      setReportTitle('')
      setReportDescription('')
      setReportCategory('general')
      await loadSavedReports()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save report')
    } finally {
      setLoading(false)
    }
  }

  async function handleLoad(id: string) {
    setLoading(true)
    setError('')

    try {
      await loadReport(id)
      // Scroll to top to show loaded report
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this report?')) {
      return
    }

    setLoading(true)
    setError('')

    try {
      await deleteReport(id)
      await loadSavedReports()
      if (currentReport?.id === id) {
        clearReport()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete report')
    } finally {
      setLoading(false)
    }
  }

  async function handleGeneratePDF(useAI: boolean = false) {
    setGeneratingAI(useAI)
    setLoading(true)
    setError('')

    try {
      await generatePDF(useAI)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setLoading(false)
      setGeneratingAI(false)
    }
  }

  function removeItem(itemId: string) {
    if (!currentReport) return
    setCurrentReport({
      ...currentReport,
      items: currentReport.items.filter(item => item.id !== itemId),
    })
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure sends={['report data']} />

      {/* Header Actions - stack on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold mb-1">Report Builder</h2>
          <p className="text-sm text-gray-400">
            Collect data from any tool and generate a comprehensive PDF report
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentReport && currentReport.items.length > 0 && (
            <>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="btn-secondary"
                disabled={loading}
              >
                Save Report
              </button>
              <button
                onClick={() => handleGeneratePDF(false)}
                className="btn-primary"
                disabled={loading}
              >
                Download PDF
              </button>
              <button
                onClick={() => handleGeneratePDF(true)}
                className="btn-primary bg-purple-600 hover:bg-purple-700"
                disabled={loading || generatingAI}
                title="Generate PDF with AI analysis"
              >
                {generatingAI ? 'Generating AI PDF...' : 'AI PDF'}
              </button>
              <button
                onClick={clearReport}
                className="btn-secondary"
                disabled={loading}
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Current Report */}
      {currentReport && currentReport.items.length > 0 ? (
        <div className="space-y-4">
          <OutputCard title={`Current Report: ${currentReport.title}`} canCopy={false}>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Items:</span>
                <span className="font-medium">{currentReport.items.length}</span>
              </div>
              {currentReport.description && (
                <div className="text-sm text-gray-300">{currentReport.description}</div>
              )}
            </div>
          </OutputCard>

          {/* Report Items */}
          <div className="space-y-3">
            {currentReport.items.map((item, index) => (
              <OutputCard key={item.id} title={`${index + 1}. ${item.toolName}`} canCopy={true}>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-sm min-w-0 flex-1">
                      <span className="text-gray-400">Input: </span>
                      <span className="font-mono text-gray-300 break-all">{item.input}</span>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-xs px-2 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 rounded transition-colors flex-shrink-0 min-h-[36px]"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                  <pre className="text-xs bg-gray-900 rounded p-3 overflow-auto max-h-64">
                    {JSON.stringify(item.data, null, 2)}
                  </pre>
                </div>
              </OutputCard>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-gray-400 mb-4">No items in current report</p>
          <p className="text-sm text-gray-500">
            Use the "Add to Report" button in any tool to start building your report
          </p>
        </div>
      )}

      {/* Saved Reports Dashboard */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-medium">Saved Reports Dashboard</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`text-xs px-3 py-1 rounded ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedCategory('pentest')}
              className={`text-xs px-3 py-1 rounded ${
                selectedCategory === 'pentest'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Pentests
            </button>
            <button
              onClick={() => setSelectedCategory('breach')}
              className={`text-xs px-3 py-1 rounded ${
                selectedCategory === 'breach'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Breaches
            </button>
            <button
              onClick={() => setSelectedCategory('report')}
              className={`text-xs px-3 py-1 rounded ${
                selectedCategory === 'report'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Reports
            </button>
            <button
              onClick={() => setSelectedCategory('general')}
              className={`text-xs px-3 py-1 rounded ${
                selectedCategory === 'general'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              General
            </button>
          </div>
        </div>
        {savedReports.length === 0 ? (
          <p className="text-sm text-gray-400">No saved reports{selectedCategory !== 'all' ? ` in ${selectedCategory}` : ''}</p>
        ) : (
          <div className="space-y-2">
            {savedReports.map(report => (
              <div
                key={report.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-gray-900/50 rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-sm truncate">{report.title}</div>
                    {report.category && (
                      <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded flex-shrink-0">
                        {report.category}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Updated: {new Date(report.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleLoad(report.id)}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
                    disabled={loading}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDelete(report.id)}
                    className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white"
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-medium mb-4">Save Report</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder={currentReport?.title || 'My Report'}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value as ReportCategory)}
                  className="input w-full"
                >
                  <option value="general">General</option>
                  <option value="pentest">Pentest</option>
                  <option value="breach">Breach</option>
                  <option value="report">Report</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Report description..."
                  className="input w-full"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card bg-red-950/20 border-red-900/50 p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Info */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">How to Use</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Use "Add to Report" button in any tool to collect results</li>
          <li>• Review and organize items in your report</li>
          <li>• Save reports for later access</li>
          <li>• Download as PDF for sharing or documentation</li>
          <li>• Reports are stored securely and isolated per user</li>
        </ul>
      </div>
    </div>
  )
}
