'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
      setTimeout(() => router.push('/'), 1500)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-white font-semibold text-lg">Password updated!</p>
          <p className="text-brand-200 text-sm mt-1">Redirecting…</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🗺️</div>
          <p className="text-brand-200 text-sm">Verifying reset link…</p>
          <p className="text-brand-300 text-xs mt-3">
            If this takes too long, the link may have expired.{' '}
            <Link href="/forgot-password" className="underline text-brand-200">Request a new one</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 flex flex-col">
      <div className="pt-16 pb-8 px-6 text-center">
        <div className="text-5xl mb-3">🗺️</div>
        <h1 className="text-white text-2xl font-bold">Trip Planner</h1>
        <p className="text-brand-200 mt-1 text-sm">Set a new password</p>
      </div>

      <div className="flex-1 bg-gray-50 rounded-t-3xl px-6 pt-8 pb-10">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Choose a new password</h2>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-field"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
