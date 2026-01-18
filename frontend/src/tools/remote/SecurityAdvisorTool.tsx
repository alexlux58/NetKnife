/**
 * ==============================================================================
 * NETKNIFE - SECURITY ADVISOR CHATBOT
 * ==============================================================================
 * 
 * AI-powered security advisor that provides guidance on security incidents
 * and recommends NetKnife tools for investigation.
 * 
 * FEATURES:
 * - Context-aware security advice
 * - Tool recommendations with step-by-step guidance
 * - Technical explanations for engineers
 * - Executive-friendly summaries
 * ==============================================================================
 */

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/api'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import { tools } from '../registry'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface AdvisorResponse {
  response: string
  recommended_tools: Array<{
    id: string
    name: string
    reason: string
    steps: string[]
    what_to_look_for: string
  }>
  technical_details: string
  executive_summary: string
  next_steps: string[]
  cached?: boolean
}

const QUICK_QUESTIONS = [
  "I think I got breached",
  "I received a suspicious email",
  "My password might be compromised",
  "I see suspicious activity on my account",
  "How do I investigate a security incident?",
  "What tools should I use for email security?",
]

export default function SecurityAdvisorTool() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [savedChats, setSavedChats] = useState<Array<{ id: string; title: string; createdAt: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSavedChats()
  }, [])

  async function loadSavedChats() {
    try {
      const response = await apiClient.post<{ reports: Array<{ id: string; title: string; createdAt: string }> }>('/reports', {
        action: 'list',
        type: 'chat',
      })
      setSavedChats(response.reports || [])
    } catch (e) {
      // Silently fail - user might not be authenticated yet or endpoint not deployed
      // Only log if it's not a 401 (authentication error)
      if (e instanceof Error && !e.message.includes('401')) {
        console.error('Failed to load chats:', e)
      }
    }
  }

  async function handleLoadChat(id: string) {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.post<{ data?: { messages?: any[] }; messages?: any[] }>('/reports', {
        action: 'get',
        type: 'chat',
        id,
      })
      // Backend returns { success, data: { title, messages } }; fallback to top-level messages for compatibility
      const list = response.data?.messages ?? response.messages
      if (Array.isArray(list) && list.length > 0) {
        setMessages(list.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          advisorResponse: msg.advisorResponse,
        })))
      } else {
        setError('Chat has no messages')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chat')
    } finally {
      setLoading(false)
    }
  }

  function getToolPath(toolId: string): string | null {
    const tool = tools.find(t => t.id === toolId)
    return tool ? tool.path : null
  }

  function handleToolClick(toolId: string) {
    const path = getToolPath(toolId)
    if (path) {
      navigate(path)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setError('')

    // Add user message
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, newUserMessage])

    setLoading(true)

    try {
      // Build conversation history (last 10 messages for context)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

      const response = await apiClient.post<AdvisorResponse>('/security-advisor', {
        message: userMessage,
        conversation_history: conversationHistory,
      })

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response || 'No response received',
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMessage])

      // Store full response in message metadata for tool recommendations
      ;(assistantMessage as any).advisorResponse = response

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get advice')
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${e instanceof Error ? e.message : 'Failed to get advice'}`,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  function handleQuickQuestion(question: string) {
    setInput(question)
  }

  function clearChat() {
    setMessages([])
    setError('')
    setSaveSuccess(false)
  }

  async function handleSaveChat() {
    if (messages.length === 0) {
      setError('No chat to save')
      return
    }

    setSaving(true)
    setError('')
    setSaveSuccess(false)

    try {
      const chatData = {
        title: `Security Advisor Chat - ${new Date().toLocaleString()}`,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          advisorResponse: (msg as any).advisorResponse,
        })),
      }

      await apiClient.post('/reports', {
        action: 'save',
        type: 'chat',
        data: chatData,
      })

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      await loadSavedChats() // Refresh list
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save chat')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure sends={['message', 'conversation history']} />

      {/* Header */}
      <div className="card p-4">
        <h2 className="text-xl font-bold mb-2">Security Advisor</h2>
        <p className="text-sm text-gray-400">
          Get expert security guidance and tool recommendations for investigating incidents.
        </p>
      </div>

      {/* Quick Questions */}
      {messages.length === 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Quick Questions</label>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickQuestion(q)}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Saved Chats */}
          {savedChats.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Saved Chats ({savedChats.length})</label>
              <div className="space-y-2">
                {savedChats.map(chat => (
                  <div
                    key={chat.id}
                    className="flex items-center justify-between p-3 bg-gray-900/50 rounded"
                  >
                    <div>
                      <div className="text-sm">{chat.title}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(chat.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleLoadChat(chat.id)}
                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
                      disabled={loading}
                    >
                      Load
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved Chats - Always visible when there are messages too */}
      {messages.length > 0 && savedChats.length > 0 && (
        <div className="card p-4">
          <label className="block text-sm font-medium mb-2">Saved Chats ({savedChats.length})</label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {savedChats.map(chat => (
              <div
                key={chat.id}
                className="flex items-center justify-between p-2 bg-gray-900/50 rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{chat.title}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(chat.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleLoadChat(chat.id)}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white ml-2 flex-shrink-0"
                  disabled={loading}
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="card p-4 min-h-[400px] max-h-[600px] overflow-y-auto flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Ask a security question to get started...
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => {
              const advisorResponse = (msg as any).advisorResponse as AdvisorResponse | undefined
              
              return (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-100'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                    
                    {/* Tool Recommendations */}
                    {advisorResponse && advisorResponse.recommended_tools.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <h4 className="font-medium mb-2 text-xs uppercase">Recommended Tools</h4>
                        <div className="space-y-3">
                          {advisorResponse.recommended_tools.map((tool, ti) => {
                            const toolPath = getToolPath(tool.id)
                            return (
                              <div key={ti} className="bg-gray-900/50 rounded p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-medium text-sm">{tool.name}</div>
                                  {toolPath && (
                                    <button
                                      onClick={() => handleToolClick(tool.id)}
                                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors"
                                    >
                                      Open Tool →
                                    </button>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400 mb-2">{tool.reason}</div>
                                {tool.steps.length > 0 && (
                                  <div className="text-xs">
                                    <div className="font-medium mb-1">Steps:</div>
                                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                                      {tool.steps.map((step, si) => (
                                        <li key={si}>{step}</li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                {tool.what_to_look_for && (
                                  <div className="text-xs mt-2">
                                    <div className="font-medium mb-1">What to look for:</div>
                                    <div className="text-gray-300">{tool.what_to_look_for}</div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Technical Details */}
                    {advisorResponse && advisorResponse.technical_details && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <h4 className="font-medium mb-2 text-xs uppercase">Technical Details</h4>
                        <div className="text-xs text-gray-300 whitespace-pre-wrap">
                          {advisorResponse.technical_details}
                        </div>
                      </div>
                    )}

                    {/* Executive Summary */}
                    {advisorResponse && advisorResponse.executive_summary && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <h4 className="font-medium mb-2 text-xs uppercase">Executive Summary</h4>
                        <div className="text-xs text-gray-300 whitespace-pre-wrap">
                          {advisorResponse.executive_summary}
                        </div>
                      </div>
                    )}

                    {/* Next Steps */}
                    {advisorResponse && advisorResponse.next_steps.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <h4 className="font-medium mb-2 text-xs uppercase">Next Steps</h4>
                        <ul className="list-disc list-inside space-y-1 text-xs text-gray-300">
                          {advisorResponse.next_steps.map((step, si) => (
                            <li key={si}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    Thinking...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card bg-red-950/20 border-red-900/50 p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask about security incidents, breaches, or investigations..."
          className="input flex-1"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="btn-primary"
        >
          Send
        </button>
        {messages.length > 0 && (
          <>
            <button
              onClick={handleSaveChat}
              disabled={saving}
              className="btn-secondary"
              title="Save this chat conversation"
            >
              {saving ? 'Saving...' : 'Save Chat'}
            </button>
            <button
              onClick={clearChat}
              className="btn-secondary"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {/* Save Success */}
      {saveSuccess && (
        <div className="card bg-green-950/20 border-green-900/50 p-3">
          <p className="text-green-400 text-sm">✓ Chat saved successfully!</p>
        </div>
      )}

      {/* Info */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About Security Advisor</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Powered by OpenAI GPT-4o-mini (cost-effective, high quality)</li>
          <li>• Provides context-aware security guidance</li>
          <li>• Recommends specific NetKnife tools for investigation</li>
          <li>• Includes both technical and executive-friendly explanations</li>
          <li>• Maintains conversation context for follow-up questions</li>
          <li>• Save chats for later reference</li>
        </ul>
        <p className="text-amber-400 text-xs mt-3">
          ⚠️ Requires OpenAI API key configured in Lambda environment variables
        </p>
      </div>
    </div>
  )
}
