/**
 * ==============================================================================
 * NETKNIFE - REPORT CONTEXT
 * ==============================================================================
 * 
 * Global context for managing reports across all tools.
 * Allows any tool to add data to a report.
 * ==============================================================================
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { apiClient } from './api'

export interface ReportItem {
  id: string
  toolId: string
  toolName: string
  timestamp: string
  input: string
  data: any
  category?: string
}

export type ReportCategory = 'pentest' | 'breach' | 'report' | 'general'

export interface Report {
  id?: string
  title: string
  description?: string
  category?: ReportCategory
  items: ReportItem[]
  createdAt?: string
  updatedAt?: string
}

interface ReportContextType {
  currentReport: Report | null
  setCurrentReport: (report: Report | null) => void
  addToReport: (toolId: string, toolName: string, input: string, data: any, category?: string) => void
  saveReport: (title?: string, description?: string, reportCategory?: ReportCategory) => Promise<string>
  loadReport: (id: string) => Promise<void>
  deleteReport: (id: string) => Promise<void>
  listReports: (category?: ReportCategory) => Promise<Array<{ id: string; title: string; category?: ReportCategory; createdAt: string; updatedAt: string }>>
  clearReport: () => void
  generatePDF: (useAI?: boolean) => Promise<void>
}

const ReportContext = createContext<ReportContextType | undefined>(undefined)

export function ReportProvider({ children }: { children: ReactNode }) {
  const [currentReport, setCurrentReport] = useState<Report | null>(null)

  const addToReport = useCallback((toolId: string, toolName: string, input: string, data: any, category?: string) => {
    setCurrentReport(prev => {
      const newReport: Report = prev || {
        title: 'NetKnife Report',
        items: [],
      }

      const newItem: ReportItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        toolId,
        toolName,
        timestamp: new Date().toISOString(),
        input,
        data,
        category,
      }

      return {
        ...newReport,
        items: [...newReport.items, newItem],
        updatedAt: new Date().toISOString(),
      }
    })
  }, [])

  const saveReport = useCallback(async (title?: string, description?: string, reportCategory?: ReportCategory): Promise<string> => {
    if (!currentReport || currentReport.items.length === 0) {
      throw new Error('No report data to save')
    }

    const category = reportCategory || currentReport.category || 'general'

    const reportToSave: Report = {
      ...currentReport,
      title: title || currentReport.title || 'NetKnife Report',
      description: description || currentReport.description,
      category: category,
      updatedAt: new Date().toISOString(),
    }

    if (!reportToSave.createdAt) {
      reportToSave.createdAt = new Date().toISOString()
    }

    const response = await apiClient.post<{ id: string }>('/reports', {
      action: 'save',
      type: 'report',
      data: reportToSave,
    })

    // Update current report with saved ID
    setCurrentReport(prev => prev ? { ...prev, id: response.id, category: category } : null)

    return response.id
  }, [currentReport])

  const loadReport = useCallback(async (id: string) => {
    const res = await apiClient.post<{
      id?: string
      title?: string
      createdAt?: string
      updatedAt?: string
      data?: { title?: string; description?: string; category?: ReportCategory; items?: ReportItem[] }
    }>('/reports', {
      action: 'get',
      type: 'report',
      id,
    })
    // Backend returns { success, id, title, data, createdAt, updatedAt }; report content is in data
    const d = res.data || {}
    const report: Report = {
      id: res.id || id,
      title: d.title || res.title || 'Report',
      description: d.description,
      category: d.category,
      items: Array.isArray(d.items) ? d.items : [],
      createdAt: res.createdAt,
      updatedAt: res.updatedAt,
    }
    setCurrentReport(report)
  }, [])

  const deleteReport = useCallback(async (id: string) => {
    await apiClient.post('/reports', {
      action: 'delete',
      type: 'report',
      id,
    })

    // Clear current report if it was deleted
    if (currentReport?.id === id) {
      setCurrentReport(null)
    }
  }, [currentReport])

  const listReports = useCallback(async (category?: ReportCategory) => {
    try {
      const response = await apiClient.post<{ reports: Array<{ id: string; title: string; category?: ReportCategory; createdAt: string; updatedAt: string }> }>('/reports', {
        action: 'list',
        type: 'report',
        category, // Optional filter
      })

      return response.reports || []
    } catch (e) {
      // Return empty array on error (endpoint might not be deployed or auth issue)
      console.error('Failed to list reports:', e)
      return []
    }
  }, [])

  const clearReport = useCallback(() => {
    setCurrentReport(null)
  }, [])

  const generatePDF = useCallback(async (useAI: boolean = false) => {
    if (!currentReport || currentReport.items.length === 0) {
      throw new Error('No report data to generate PDF')
    }

    // If AI is requested, generate AI analysis first
    let aiAnalysis = null
    if (useAI) {
      try {
        // Build a summary of all items for AI analysis
        const itemsSummary = currentReport.items.map((item, idx) => 
          `${idx + 1}. ${item.toolName}: ${item.input}`
        ).join('\n')
        
        const analysisResponse = await apiClient.post<{ response: string }>('/security-advisor', {
          message: `Analyze this security report and provide a comprehensive executive summary, key findings, risk assessment, and recommendations.\n\nReport Title: ${currentReport.title}\nReport Category: ${currentReport.category || 'general'}\nNumber of Items: ${currentReport.items.length}\n\nItems Summary:\n${itemsSummary}\n\nPlease provide:\n1. Executive Summary\n2. Key Findings\n3. Risk Assessment\n4. Recommendations\n5. Next Steps`,
          conversation_history: [],
        })
        aiAnalysis = analysisResponse.response
      } catch (e) {
        console.warn('AI analysis failed, generating PDF without AI:', e)
      }
    }

    // Dynamic import to avoid SSR issues
    const { jsPDF } = await import('jspdf')

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    let yPos = 20
    const pageHeight = doc.internal.pageSize.height
    const pageWidth = doc.internal.pageSize.width
    const margin = 20
    const contentWidth = pageWidth - (margin * 2)

    // Helper to add new page if needed
    const checkPageBreak = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - margin) {
        doc.addPage()
        yPos = margin
        return true
      }
      return false
    }

    // Title
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    const titleLines = doc.splitTextToSize(currentReport.title || 'NetKnife Report', contentWidth)
    doc.text(titleLines, margin, yPos)
    yPos += titleLines.length * 8 + 5

    // Description
    if (currentReport.description) {
      checkPageBreak(15)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      const descLines = doc.splitTextToSize(currentReport.description, contentWidth)
      doc.text(descLines, margin, yPos)
      yPos += descLines.length * 6 + 8
    }

    // Category
    if (currentReport.category) {
      checkPageBreak(8)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(60, 100, 200)
      doc.text(`Category: ${currentReport.category.toUpperCase()}`, margin, yPos)
      yPos += 7
    }

    // Metadata
    checkPageBreak(12)
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'normal')
    const metadata = [
      `Generated: ${new Date().toLocaleString()}`,
      `Items: ${currentReport.items.length}`,
      currentReport.createdAt ? `Created: ${new Date(currentReport.createdAt).toLocaleString()}` : '',
    ].filter(Boolean)
    doc.text(metadata, margin, yPos)
    yPos += metadata.length * 5 + 10

    // AI Analysis section
    if (aiAnalysis) {
      checkPageBreak(40)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('AI Analysis & Recommendations', margin, yPos)
      yPos += 10

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(50, 50, 50)
      const analysisLines = doc.splitTextToSize(aiAnalysis, contentWidth)
      doc.text(analysisLines, margin, yPos)
      yPos += analysisLines.length * 5 + 15
    }

    // Items
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text('Report Items', margin, yPos)
    yPos += 10

    for (let i = 0; i < currentReport.items.length; i++) {
      const item = currentReport.items[i]
      checkPageBreak(30)

      // Item header
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      const itemTitle = `${i + 1}. ${item.toolName}`
      doc.text(itemTitle, margin, yPos)
      yPos += 7

      // Category
      if (item.category) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(100, 100, 100)
        doc.text(`Category: ${item.category}`, margin + 5, yPos)
        yPos += 5
      }

      // Input
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(50, 50, 50)
      const inputText = `Input: ${item.input}`
      const inputLines = doc.splitTextToSize(inputText, contentWidth - 10)
      doc.text(inputLines, margin + 5, yPos)
      yPos += inputLines.length * 5 + 3

      // Timestamp
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(`Time: ${new Date(item.timestamp).toLocaleString()}`, margin + 5, yPos)
      yPos += 5

      // Data (formatted JSON)
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      doc.setFont('courier', 'normal')
      
      try {
        const dataStr = JSON.stringify(item.data, null, 2)
        const dataLines = doc.splitTextToSize(dataStr, contentWidth - 10)
        
        // Limit to prevent huge PDFs, but show more than before
        const maxLines = Math.min(dataLines.length, 50)
        for (let j = 0; j < maxLines; j++) {
          checkPageBreak(5)
          doc.text(dataLines[j], margin + 5, yPos)
          yPos += 4
        }

        if (dataLines.length > maxLines) {
          checkPageBreak(5)
          doc.setFont('helvetica', 'italic')
          doc.setTextColor(150, 150, 150)
          doc.text(`... (${dataLines.length - maxLines} more lines truncated)`, margin + 5, yPos)
          yPos += 4
        }
      } catch (e) {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(200, 0, 0)
        doc.text('Error formatting data', margin + 5, yPos)
        yPos += 5
      }

      yPos += 8 // Spacing between items
    }

    // Footer on last page
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )
    }

    // Save PDF
    const safeTitle = (currentReport.title || 'report').replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const filename = `${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
  }, [currentReport])

  return (
    <ReportContext.Provider
      value={{
        currentReport,
        setCurrentReport,
        addToReport,
        saveReport,
        loadReport,
        deleteReport,
        listReports,
        clearReport,
        generatePDF,
      }}
    >
      {children}
    </ReportContext.Provider>
  )
}

export function useReport() {
  const context = useContext(ReportContext)
  if (context === undefined) {
    throw new Error('useReport must be used within a ReportProvider')
  }
  return context
}
