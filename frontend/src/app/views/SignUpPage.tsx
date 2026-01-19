/**
 * ==============================================================================
 * NETKNIFE - SIGN UP PAGE (custom form)
 * ==============================================================================
 *
 * Collects username, password, email, and optional phone, then calls Cognito
 * SignUp so these are stored and included in signup notifications. The Hosted
 * UI often omits optional attributes; this form ensures we capture them.
 *
 * After success, user is prompted to sign in (Hosted UI or same flow).
 * ==============================================================================
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUpWithAttributes } from '../../lib/auth'

export default function SignUpPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const u = username.trim()
    const p = password
    const em = email.trim()
    const ph = phone.trim()

    if (!u) {
      setError('Username is required')
      return
    }
    if (!p) {
      setError('Password is required')
      return
    }
    if (p !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (!em) {
      setError('Email is required')
      return
    }
    if (p.length < 14) {
      setError('Password must be at least 14 characters')
      return
    }

    setLoading(true)
    try {
      await signUpWithAttributes({
        username: u,
        password: p,
        email: em,
        phone: ph || undefined,
      })
      setDone(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-up failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-terminal-bg">
        <div className="card p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-2">Account created</h1>
          <p className="text-gray-400 mb-6">Sign in to continue.</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full btn-primary py-3"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-terminal-bg">
      <div className="card p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-1">Create account</h1>
        <p className="text-gray-400 text-sm mb-6">
          We collect email and phone so you can be notified and we can reach you if needed.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alice"
              className="input w-full"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email <span className="text-red-400">*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input w-full"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone <span className="text-gray-500">(optional)</span></label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
              className="input w-full"
              autoComplete="tel"
            />
            <p className="text-xs text-gray-500 mt-1">E.164 format, e.g. +15551234567</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="14+ chars, mixed case, number, symbol"
              className="input w-full"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Same as above"
              className="input w-full"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="p-3 rounded bg-red-950/30 border border-red-900/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3"
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-400 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
