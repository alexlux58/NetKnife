/**
 * User settings: profile (avatar, bio, display name), theme, subscription link.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfile, updateProfile, type UserProfile } from '../../lib/profile'
import { useTheme } from '../../lib/ThemeContext'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({ displayName: '', avatarUrl: '', bio: '' })

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p)
        setForm({ displayName: p.displayName || '', avatarUrl: p.avatarUrl || '', bio: p.bio || '' })
      })
      .catch(() => setProfile({ theme: 'dark', avatarUrl: null, bio: null, displayName: null }))
      .finally(() => setLoading(false))
  }, [])

  const onSaveProfile = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const p = await updateProfile({
        displayName: form.displayName.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        bio: form.bio.trim() || null,
      })
      setProfile(p)
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
            <label className="block text-sm text-gray-400 mb-1">Avatar URL</label>
            <input
              type="url"
              placeholder="https://…"
              value={form.avatarUrl}
              onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
              className="input w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Paste an image URL for your profile picture.</p>
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
