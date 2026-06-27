'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    // Always show success to avoid revealing whether an email exists
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 flex flex-col">
        <div className="pt-16 pb-8 px-6 text-center">
          <div className="text-5xl mb-3">📧</div>
          <h1 className="text-white text-2xl font-bold">Check your email</h1>
          <p className="text-brand-200 mt-2 text-sm px-4">
            If an account exists for <strong className="text-white">{email}</strong>, a reset link has been sent.
          </p>
        </div>
        <div className="flex-1 bg-gray-50 rounded-t-3xl px-6 pt-8 pb-10">
          <p className="text-sm text-gray-600 mb-6">
            Click the link in the email to set a new password. The link expires in 1 hour.
          </p>
          <Link href="/login" className="btn-primary block text-center">
            Back to sign in
          </Link>
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
