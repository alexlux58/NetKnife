/**
 * Message board: channels (admin-created), threads, comments, like, bookmark, DMs.
 * Request new channel: admin@alexflux.com
 */

import { useEffect, useState } from 'react'
import { getProfile } from '../../lib/profile'
import {
  channelsList,
  channelCreate,
  threadsList,
  threadCreate,
  threadGet,
  commentAdd,
  likeToggle,
  bookmarkToggle,
  bookmarksList,
  dmConvos,
  dmMessages,
  dmSend,
} from '../../lib/board'

const DM_REQUEST = 'admin@alexflux.com'

type Channel = { id: string; name: string; description: string; createdAt: string }
type Thread = { id: string; channelId: string; title: string; body: string; authorId: string; authorName: string; createdAt: string }
type BookmarkItem = { id: string; channelId: string; title: string; authorName: string; createdAt: string }
type Comment = { id: string; threadId: string; body: string; authorId: string; authorName: string; createdAt: string }

export default function BoardPage() {
  const [profile, setProfile] = useState<{ displayName?: string | null } | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [selectedThread, setSelectedThread] = useState<{ thread: Thread; comments: Comment[]; likeCount: number; isLiked: boolean; isBookmarked: boolean } | null>(null)
  const [dmConvoList, setDmConvoList] = useState<{ otherUserId: string; lastAt: string; lastPreview: string; outbound?: boolean }[]>([])
  const [dmOther, setDmOther] = useState<string | null>(null)
  const [dmMsgs, setDmMsgs] = useState<{ id: string; fromUserId: string; fromName: string; body: string; createdAt: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const [newThreadTitle, setNewThreadTitle] = useState('')
  const [newThreadBody, setNewThreadBody] = useState('')
  const [newComment, setNewComment] = useState('')
  const [newDmBody, setNewDmBody] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [showNewThread, setShowNewThread] = useState(false)

  const displayName = (profile?.displayName || '').trim() || '?'

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProfile(null))
  }, [])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ch, bk, conv] = await Promise.all([channelsList(), bookmarksList(), dmConvos()])
      setChannels(ch.channels || [])
      setBookmarks(bk.threads || [])
      setDmConvoList(conv.convos || [])
    } catch (e: unknown) {
      setError((e as { body?: { error?: string } })?.body?.error || 'Failed to load board')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!selectedChannel) {
      setThreads([])
      setSelectedThread(null)
      return
    }
    threadsList(selectedChannel)
      .then((r) => setThreads(r.threads || []))
      .catch(() => setThreads([]))
  }, [selectedChannel])

  useEffect(() => {
    if (!dmOther) {
      setDmMsgs([])
      return
    }
    dmMessages(dmOther).then((r) => setDmMsgs(r.messages || [])).catch(() => setDmMsgs([]))
  }, [dmOther])

  const doCreateChannel = async () => {
    const n = newChannelName.trim()
    if (!n) return
    setActionError(null)
    try {
      await channelCreate(n, newChannelDesc.trim())
      setNewChannelName('')
      setNewChannelDesc('')
      setShowNewChannel(false)
      load()
    } catch (e: unknown) {
      setActionError((e as { body?: { error?: string } })?.body?.error || 'Failed to create channel')
    }
  }

  const doCreateThread = async () => {
    const title = newThreadTitle.trim()
    if (!selectedChannel || !title) return
    setActionError(null)
    try {
      await threadCreate(selectedChannel, title, newThreadBody.trim(), displayName)
      setNewThreadTitle('')
      setNewThreadBody('')
      setShowNewThread(false)
      threadsList(selectedChannel).then((r) => setThreads(r.threads || []))
    } catch (e: unknown) {
      setActionError((e as { body?: { error?: string } })?.body?.error || 'Failed to create thread')
    }
  }

  const doAddComment = async () => {
    const b = newComment.trim()
    if (!selectedThread || !b) return
    setActionError(null)
    try {
      await commentAdd(selectedThread.thread.id, b, displayName)
      setNewComment('')
      if (selectedChannel) {
        const r = await threadGet(selectedChannel, selectedThread.thread.id)
        setSelectedThread(r)
      }
    } catch (e: unknown) {
      setActionError((e as { body?: { error?: string } })?.body?.error || 'Failed to add comment')
    }
  }

  const doLike = async () => {
    if (!selectedThread) return
    try {
      const r = await likeToggle(selectedThread.thread.id)
      if (selectedChannel) {
        const g = await threadGet(selectedChannel, selectedThread.thread.id)
        setSelectedThread({ ...g, isLiked: r.liked })
      }
    } catch (_) {}
  }

  const doBookmark = async () => {
    if (!selectedThread || !selectedChannel) return
    try {
      const r = await bookmarkToggle(selectedThread.thread.id, selectedChannel)
      if (selectedChannel) {
        const g = await threadGet(selectedChannel, selectedThread.thread.id)
        setSelectedThread({ ...g, isBookmarked: r.bookmarked })
      }
      bookmarksList().then((x) => setBookmarks(x.threads || []))
    } catch (_) {}
  }

  const doDmSend = async () => {
    const b = newDmBody.trim()
    if (!dmOther || !b) return
    setActionError(null)
    try {
      await dmSend(dmOther, b, displayName)
      setNewDmBody('')
      dmMessages(dmOther).then((r) => setDmMsgs(r.messages || []))
      dmConvos().then((r) => setDmConvoList(r.convos || []))
    } catch (e: unknown) {
      setActionError((e as { body?: { error?: string } })?.body?.error || 'Failed to send')
    }
  }

  const openDm = (otherUserId: string) => {
    setDmOther(otherUserId)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Message board</h1>
      <p className="text-gray-400 text-sm mb-4">
        Request a new channel: <a href={`mailto:${DM_REQUEST}`} className="text-blue-400 hover:underline">{DM_REQUEST}</a>. Only admins can create channels.
      </p>

      {(error || actionError) && (
        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error || actionError}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left: channels + bookmarks + DMs */}
        <div className="card p-4 space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Channels</h2>
            <ul className="space-y-1 text-sm">
              {channels.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => { setSelectedChannel(c.id); setSelectedThread(null); }}
                    className={`w-full text-left px-2 py-1 rounded ${selectedChannel === c.id ? 'bg-blue-600/30 text-blue-300' : 'hover:bg-gray-700'}`}
                    title={c.description || undefined}
                  >
                    # {c.name}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowNewChannel((x) => !x)} className="mt-2 text-xs text-blue-400 hover:underline">
              + Add channel
            </button>
            {showNewChannel && (
              <div className="mt-2 space-y-2">
                <input
                  placeholder="Name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="input w-full text-sm py-1.5"
                />
                <input
                  placeholder="Description (optional)"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  className="input w-full text-sm py-1.5"
                />
                <button onClick={doCreateChannel} className="btn-primary text-sm py-1.5">Create</button>
              </div>
            )}
          </div>
          <div>
            <h2 className="font-semibold mb-2">Bookmarks</h2>
            <ul className="space-y-1 text-sm text-gray-400">
              {bookmarks.length === 0 && <li>None</li>}
              {bookmarks.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => {
                      setSelectedChannel(t.channelId)
                      setSelectedThread(null)
                      threadsList(t.channelId).then((r) => setThreads(r.threads || []))
                      threadGet(t.channelId, t.id).then(setSelectedThread).catch(() => {})
                    }}
                    className="hover:text-white truncate block text-left w-full"
                  >
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold mb-2">Direct messages</h2>
            <div className="space-y-2">
              <div>
                <h3 className="text-xs text-gray-500 mb-1">Inbox (received)</h3>
                <ul className="space-y-1 text-sm text-gray-400">
                  {(dmConvoList.filter((c) => !c.outbound)).length === 0 && <li>None</li>}
                  {dmConvoList.filter((c) => !c.outbound).map((c) => (
                    <li key={c.otherUserId}>
                      <button onClick={() => setDmOther(c.otherUserId)} className={`w-full text-left px-2 py-1 rounded truncate ${dmOther === c.otherUserId ? 'bg-blue-600/30 text-blue-300' : 'hover:bg-gray-700'}`}>
                        {c.otherUserId} — {c.lastPreview || '…'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs text-gray-500 mb-1">Outbox (sent)</h3>
                <ul className="space-y-1 text-sm text-gray-400">
                  {(dmConvoList.filter((c) => c.outbound)).length === 0 && <li>None</li>}
                  {dmConvoList.filter((c) => c.outbound).map((c) => (
                    <li key={c.otherUserId}>
                      <button onClick={() => setDmOther(c.otherUserId)} className={`w-full text-left px-2 py-1 rounded truncate ${dmOther === c.otherUserId ? 'bg-blue-600/30 text-blue-300' : 'hover:bg-gray-700'}`}>
                        {c.otherUserId} — {c.lastPreview || '…'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Center: threads or thread view */}
        <div className="card p-4 md:col-span-2">
          {!selectedChannel && <p className="text-gray-500 text-sm">Select a channel</p>}
          {selectedChannel && !selectedThread && (() => {
            const ch = channels.find((c) => c.id === selectedChannel)
            return (
            <>
              {ch?.description && <p className="text-gray-400 text-sm mb-3">{ch.description}</p>}
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold">Threads</h2>
                <button onClick={() => setShowNewThread((x) => !x)} className="text-sm text-blue-400 hover:underline">+ New thread</button>
              </div>
              {showNewThread && (
                <div className="mb-4 p-3 rounded bg-gray-800 space-y-2">
                  <input placeholder="Title" value={newThreadTitle} onChange={(e) => setNewThreadTitle(e.target.value)} className="input w-full text-sm" />
                  <textarea placeholder="Body (optional)" value={newThreadBody} onChange={(e) => setNewThreadBody(e.target.value)} rows={2} className="input w-full text-sm resize-y" />
                  <button onClick={doCreateThread} className="btn-primary text-sm py-1.5">Post</button>
                </div>
              )}
              <ul className="space-y-2">
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => threadGet(selectedChannel, t.id).then(setSelectedThread).catch(() => {})}
                      className="w-full text-left p-3 rounded bg-gray-800/50 hover:bg-gray-800 border border-transparent hover:border-gray-600"
                    >
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-gray-500">{t.authorName} · {new Date(t.createdAt).toLocaleString()}</div>
                    </button>
                  </li>
                ))}
                {threads.length === 0 && <li className="text-gray-500 text-sm">No threads yet</li>}
              </ul>
            </>
          ); })()}
          {selectedChannel && selectedThread && (
            <>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="font-semibold text-lg">{selectedThread.thread.title}</h2>
                  <p className="text-sm text-gray-500">{selectedThread.thread.authorName} · {new Date(selectedThread.thread.createdAt).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedThread(null)} className="text-sm text-gray-500 hover:text-white">← Back</button>
              </div>
              <div className="prose prose-invert text-sm mb-4 whitespace-pre-wrap">{selectedThread.thread.body || '(no body)'}</div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={doLike}
                  className={`text-sm px-3 py-1.5 rounded ${selectedThread.isLiked ? 'bg-red-600/30 text-red-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                >
                  ♥ {selectedThread.likeCount}
                </button>
                <button
                  onClick={doBookmark}
                  className={`text-sm px-3 py-1.5 rounded ${selectedThread.isBookmarked ? 'bg-blue-600/30 text-blue-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                >
                  Bookmark
                </button>
                <button onClick={() => openDm(selectedThread.thread.authorId)} className="text-sm px-3 py-1.5 rounded bg-gray-700 text-gray-400 hover:bg-gray-600">
                  Message {selectedThread.thread.authorName}
                </button>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <h3 className="font-medium mb-2">Comments</h3>
                {selectedThread.comments.map((c) => (
                  <div key={c.id} className="py-2 border-b border-gray-800 flex justify-between items-start gap-2">
                    <div>
                      <span className="text-blue-400 font-medium">{c.authorName}</span>
                      <span className="text-gray-500 text-xs ml-2">{new Date(c.createdAt).toLocaleString()}</span>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                    </div>
                    <button onClick={() => openDm(c.authorId)} className="text-xs text-gray-500 hover:text-blue-400 shrink-0">Message</button>
                  </div>
                ))}
                <div className="mt-3 flex gap-2">
                  <textarea
                    placeholder="Add a comment…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="input flex-1 resize-y text-sm"
                  />
                  <button onClick={doAddComment} disabled={!newComment.trim()} className="btn-primary text-sm py-2 self-end">Post</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* DM panel (modal or side) */}
      {dmOther && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setDmOther(null)}>
          <div className="card p-4 w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold">DM with {dmOther}</h3>
              <button onClick={() => setDmOther(null)} className="text-gray-500 hover:text-white">×</button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[200px] space-y-2 mb-3">
              {dmMsgs.map((m) => (
                <div key={m.id} className={`text-sm ${m.fromUserId === dmOther ? '' : 'text-right'}`}>
                  <span className="text-gray-500">{m.fromName}</span>
                  <p className="mt-0.5 break-words">{m.body}</p>
                  <span className="text-xs text-gray-600">{new Date(m.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                placeholder="Message…"
                value={newDmBody}
                onChange={(e) => setNewDmBody(e.target.value)}
                rows={2}
                className="input flex-1 resize-y text-sm"
              />
              <button onClick={doDmSend} disabled={!newDmBody.trim()} className="btn-primary text-sm py-2 self-end">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
