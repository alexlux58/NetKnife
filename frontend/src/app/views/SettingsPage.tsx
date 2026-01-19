/**
 * User settings: profile (avatar, bio, display name), theme, subscription link.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfile, updateProfile } from '../../lib/profile'
import { useTheme } from '../../lib/ThemeContext'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({ displayName: '', avatarUrl: '', bio: '' })

  useEffect(() => {
    getProfile()
      .then((p) => {
        setForm({ displayName: p.displayName || '', avatarUrl: p.avatarUrl || '', bio: p.bio || '' })
      })
      .catch(() => setForm({ displayName: '', avatarUrl: '', bio: '' }))
      .finally(() => setLoading(false))
  }, [])

  const onSaveProfile = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await updateProfile({
        displayName: form.displayName.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        bio: form.bio.trim() || null,
      })
      setMessage('Saved.')
      setTimeout(() => setMessage(null), 3000)
    } catch (e) {
      setMessage('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400" />
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-bold">Account &amp; settings</h1>

      {/* Profile: avatar, display name, bio */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Avatar</label>
            <div className="flex flex-wrap gap-2 items-start">
              <input
                type="url"
                placeholder="https://… or upload below"
                value={form.avatarUrl && form.avatarUrl.startsWith('http') ? form.avatarUrl : ''}
                onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value.trim() || (f.avatarUrl?.startsWith('data:') ? f.avatarUrl : '') }))}
                className="input flex-1 min-w-[200px]"
              />
              <label className="btn-secondary cursor-pointer inline-block py-2 px-3 text-sm">
                Upload PNG/JPG/WebP
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const reader = new FileReader()
                    reader.onload = () => {
                      const data = reader.result as string
                      if (typeof data === 'string' && data.startsWith('data:image/')) {
                        setForm((prev) => ({ ...prev, avatarUrl: data }))
                      }
                    }
                    reader.readAsDataURL(f)
                    e.target.value = ''
                  }}
                />
              </label>
              {(form.avatarUrl || '').length > 0 && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, avatarUrl: '' }))}
                  className="text-sm text-gray-500 hover:text-gray-300"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Paste an image URL or upload PNG, JPG, or WebP (max ~200KB).</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Display name</label>
            <input
              type="text"
              placeholder="Your name"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Bio</label>
            <textarea
              placeholder="A short bio…"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3}
              maxLength={500}
              className="input w-full resize-y"
            />
            <p className="text-xs text-gray-500 mt-1">{form.bio.length}/500</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onSaveProfile} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            {message && <span className="text-sm text-gray-400">{message}</span>}
          </div>
          <p className="text-xs text-gray-500 mt-3">Preview (shown in top bar):</p>
          <div className="flex items-center gap-2 mt-1">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-gray-400 text-xs">?</span>
            )}
            <span className="text-sm text-gray-400">{form.displayName?.trim() || 'Account'}</span>
            {form.bio?.trim() && <span className="text-xs text-gray-500 truncate max-w-[200px]">— {form.bio.trim()}</span>}
          </div>
        </div>
      </section>

      {/* Appearance: theme */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Theme</label>
          <div className="flex flex-wrap gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  theme === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {t === 'system' ? 'System' : t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">System follows your device preference.</p>
        </div>
      </section>

      {/* Subscription */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Subscription</h2>
        <p className="text-gray-400 text-sm mb-4">
          Local tools are always free. For DNS, RDAP, threat intel, and other AWS/remote tools, subscribe to API Access.
        </p>
        <Link to="/pricing" className="btn-primary inline-block">
          View plans &amp; manage subscription
        </Link>
      </section>
    </div>
  )
}
