/**
 * Board API: channels, threads, comments, likes, bookmarks, DMs.
 * POST /board { action, ... }
 */

import { apiPost } from './api'

export async function boardActions<T = unknown>(body: Record<string, unknown>): Promise<T> {
  return apiPost<T>('/board', body)
}

export function channelsList() {
  return boardActions<{ channels: { id: string; name: string; description: string; createdAt: string }[] }>({ action: 'channels-list' })
}

export function channelCreate(name: string, description: string) {
  return boardActions<{ channel: { id: string; name: string; description: string; createdAt: string } }>({ action: 'channel-create', name, description })
}

export function threadsList(channelId: string) {
  return boardActions<{ threads: { id: string; channelId: string; title: string; body: string; authorId: string; authorName: string; createdAt: string }[] }>({ action: 'threads-list', channelId })
}

export function threadCreate(channelId: string, title: string, body: string, authorName: string) {
  return boardActions<{ thread: { id: string; channelId: string; title: string; body: string; authorId: string; authorName: string; createdAt: string } }>({ action: 'thread-create', channelId, title, body, authorName })
}

export function threadGet(channelId: string, threadId: string) {
  return boardActions<{
    thread: { id: string; channelId: string; title: string; body: string; authorId: string; authorName: string; createdAt: string }
    comments: { id: string; threadId: string; body: string; authorId: string; authorName: string; createdAt: string }[]
    likeCount: number
    isLiked: boolean
    isBookmarked: boolean
  }>({ action: 'thread-get', channelId, threadId })
}

export function commentAdd(threadId: string, body: string, authorName: string) {
  return boardActions<{ comment: { id: string; threadId: string; body: string; authorId: string; authorName: string; createdAt: string } }>({ action: 'comment-add', threadId, body, authorName })
}

export function likeToggle(threadId: string) {
  return boardActions<{ liked: boolean }>({ action: 'like-toggle', threadId })
}

export function bookmarkToggle(threadId: string, channelId: string) {
  return boardActions<{ bookmarked: boolean }>({ action: 'bookmark-toggle', threadId, channelId })
}

export function bookmarksList() {
  return boardActions<{ threads: { id: string; channelId: string; title: string; authorName: string; createdAt: string }[] }>({ action: 'bookmarks-list' })
}

export function dmConvos() {
  return boardActions<{ convos: { otherUserId: string; lastAt: string; lastPreview: string }[] }>({ action: 'dm-convos' })
}

export function dmMessages(otherUserId: string) {
  return boardActions<{ messages: { id: string; fromUserId: string; fromName: string; body: string; createdAt: string }[] }>({ action: 'dm-messages', otherUserId })
}

export function dmSend(otherUserId: string, body: string, fromName: string) {
  return boardActions<{ message: { id: string; fromUserId: string; fromName: string; body: string; createdAt: string } }>({ action: 'dm-send', otherUserId, body, fromName })
}
