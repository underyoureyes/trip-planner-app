'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/reset`

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    setLoading(false)

    if (resetError) {
      // Surface the real error — useful for diagnosing Supabase config issues
      // (e.g. redirectTo not in Supabase allowed redirect URLs list)
      setError(resetError.message)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 flex flex-col">
        <div className="pt-16 pb-8 px-6 text-center">
          <div className="text-5xl mb-3">📧</div>
          <h1 className="text-white text-2xl font-bold">Check your email</h1>
          <p className="text-brand-200 mt-2 text-sm px-4">
            A reset link has been sent to <strong className="text-white">{email}</strong>
          </p>
        </div>
        <div className="flex-1 bg-gray-50 rounded-t-3xl px-6 pt-8 pb-10 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1.5">
            <p className="font-semibold">📬 Didn&apos;t arrive?</p>
            <p>• Check your spam / junk folder</p>
            <p>• The link expires in 1 hour</p>
            <p>• Only one active reset link exists at a time</p>
          </div>
          <Link href="/login" className="btn-primary block text-center">
            Back to sign in
          </Link>
          <button
            onClick={() => { setSent(false) }}
            className="w-full text-center text-sm text-gray-500 underline underline-offset-2"
          >
            Send again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 flex flex-col">
      <div className="pt-16 pb-8 px-6 text-center">
        <div className="text-5xl mb-3">🗺️</div>
        <h1 className="text-white text-2xl font-bold">Trip Planner</h1>
        <p className="text-brand-200 mt-1 text-sm">Reset your password</p>
      </div>

      <div className="flex-1 bg-gray-50 rounded-t-3xl px-6 pt-8 pb-10">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Forgot password?</h2>
        <p className="text-sm text-gray-500 mb-6">Enter your email and we&apos;ll send you a reset link.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <p className="font-semibold mb-1">Could not send reset email</p>
              <p>{error}</p>
              {error.toLowerCase().includes('redirect') && (
                <p className="mt-2 text-xs text-red-600">
                  In Supabase → Authentication → URL Configuration, add{' '}
                  <strong>{typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset</strong>{' '}
                  to the Redirect URLs list.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/login" className="text-brand-600 font-medium">← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
