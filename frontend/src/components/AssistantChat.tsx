/**
 * NetKnife Assistant – floating chatbot in the bottom-right.
 * Helps navigate the app and answer questions. Uses /security-advisor with mode: "help".
 */

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  suggested_links?: { label: string; path: string }[]
}

const QUICK_STARTERS = [
  'Where is the DNS tool?',
  'How do I check email reputation?',
  "What's on the Pricing page?",
  'How do I get to the message board?',
]

export default function AssistantChat() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const listEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(userMessage: string) {
    const text = (userMessage || input).trim()
    if (!text) return
    setInput('')
    setError('')

    const user: Message = { role: 'user', content: text }
    setMessages((m) => [...m, user])
    setLoading(true)

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const res = await apiClient.post<{ response: string; suggested_links?: { label: string; path: string }[] }>(
        '/security-advisor',
        { mode: 'help', message: text, conversation_history: history }
      )
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.response || 'No response.',
          suggested_links: res.suggested_links || [],
        },
      ])
    } catch (e) {
      const err = e as { body?: { error?: string }; message?: string }
      const msg = err?.body?.error || err?.message || 'Assistant is unavailable. Check that the API and OpenAI are configured.'
      setError(msg)
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  function handleNav(path: string) {
    if (path) navigate(path)
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#0d1117]"
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-40 flex w-[380px] max-w-[calc(100vw-3rem)] flex-col rounded-xl border border-[#30363d] bg-[#161b22] shadow-xl"
          style={{ maxHeight: 'min(520px, 80vh)' }}
        >
          <div className="flex items-center justify-between border-b border-[#30363d] px-4 py-3">
            <h3 className="font-semibold text-white">Assistant</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1.5 text-gray-400 hover:bg-[#21262d] hover:text-white"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Ask about navigation, tools, or anything NetKnife.</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_STARTERS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => send(q)}
                        className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-left text-sm text-gray-300 hover:border-blue-500/50 hover:bg-[#30363d]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#21262d] text-gray-200'
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' && m.suggested_links && m.suggested_links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.suggested_links.map((l, j) => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => handleNav(l.path)}
                          className="rounded-md border border-blue-500/50 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-400 hover:bg-blue-500/20"
                        >
                          {l.label || l.path}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-start gap-2">
                  <div className="rounded-lg bg-[#21262d] px-3 py-2 text-sm text-gray-400">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gray-500" /> Thinking…
                  </div>
                </div>
              )}
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}
              <div ref={listEndRef} />
            </div>

            <form
              className="border-t border-[#30363d] p-3"
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything…"
                  className="input flex-1 py-2 text-sm"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="btn-primary py-2 text-sm"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
