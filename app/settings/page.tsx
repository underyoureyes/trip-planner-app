'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { UsageSummary } from '@/lib/usage'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyHint, setApiKeyHint] = useState<string | null>(null)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [distanceUnit, setDistanceUnit] = useState<'metric' | 'imperial'>('metric')
  const [currency, setCurrency] = useState('GBP')
  const [validatingKey, setValidatingKey] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setHasApiKey(data.has_api_key)
      setApiKeyHint(data.api_key_hint)
      setDistanceUnit(data.distance_unit || 'metric')
      setCurrency(data.currency || 'GBP')
      setLoading(false)
    })
    fetch('/api/usage').then(r => r.json()).then(data => {
      if (data.summary) setUsage(data.summary)
    }).catch(() => {/* ignore */})
  }, [])

  async function save() {
    setSaving(true); setError(''); setMessage(''); setKeyError('')
    if (apiKey.trim()) {
      if (!apiKey.startsWith('sk-ant-')) { setKeyError('Claude API keys start with sk-ant-'); setSaving(false); return }
      setValidatingKey(true)
      const res = await fetch('/api/settings/validate-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }) })
      const json = await res.json()
      setValidatingKey(false)
      if (!json.valid) { setKeyError('Key rejected by Claude — double-check it'); setSaving(false); return }
    }
    const body: Record<string, unknown> = { distance_unit: distanceUnit, currency }
    if (apiKey.trim()) body.claude_api_key = apiKey.trim()
    const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error || 'Save failed')
    } else {
      setMessage('Settings saved!')
      if (apiKey.trim()) { setHasApiKey(true); setApiKeyHint(apiKey.slice(0, 14) + '…'); setApiKey('') }
    }
    setSaving(false)
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login'); router.refresh()
  }

  async function removeApiKey() {
    setSaving(true)
    await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claude_api_key: '' }) })
    setHasApiKey(false); setApiKeyHint(null); setApiKey(''); setMessage('API key removed'); setSaving(false)
  }

  async function resetDemoTrips() {
    if (!confirm('Reset the Scotland 2026 and Lake Garda 2026 demo trips to their latest data? Any edits you\'ve made to them will be lost.')) return
    setResetting(true); setResetMessage('')
    const res = await fetch('/api/import-trips', { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setResetting(false)
    setResetMessage(res.ok ? 'Done — reopen the trip to see the latest data.' : (json.error || 'Reset failed'))
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400 text-sm">Loading…</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-brand-900 to-brand-700 px-6 pt-14 pb-6">
        <div className="flex items-center gap-3">
          <Link href="/trips" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-white text-xl font-bold">Settings</h1>
        </div>
      </div>

      <div className="px-4 pt-6 pb-32 space-y-5">
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">Claude API key</h2>
          {hasApiKey && (
            <div className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-green-700">✅ Key set</p>
                {apiKeyHint && <p className="text-xs text-green-600 font-mono mt-0.5">{apiKeyHint}</p>}
              </div>
              <button onClick={removeApiKey} className="text-xs text-red-500 font-medium px-2 py-1">Remove</button>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{hasApiKey ? 'Replace with new key' : 'Enter your key'}</label>
            <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); setKeyError('') }}
              className="input-field font-mono text-sm" placeholder="sk-ant-api03-…" autoComplete="off" spellCheck={false} />
            <p className="text-xs text-gray-400 mt-1.5"><a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">console.anthropic.com</a></p>
            {keyError && <p className="text-xs text-red-600 mt-1">{keyError}</p>}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Preferences</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Distance units</label>
            <div className="flex gap-2">
              {(['metric', 'imperial'] as const).map(u => (
                <button key={u} type="button" onClick={() => setDistanceUnit(u)}
                  className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    distanceUnit === u ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-700'
                  }`}>{u === 'metric' ? 'km' : 'miles'}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-field bg-white">
              <option value="GBP">🇬🇧 GBP</option>
              <option value="EUR">🇪🇺 EUR</option>
              <option value="USD">🇺🇸 USD</option>
              <option value="CAD">🇨🇦 CAD</option>
              <option value="AUD">🇦🇺 AUD</option>
              <option value="CHF">🇨🇭 CHF</option>
            </select>
          </div>
        </div>

        {/* ── API Usage ── */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">Claude API usage</h2>
          {usage ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-blue-50 px-3 py-3 text-center">
                  <p className="text-[11px] text-blue-500 font-semibold uppercase tracking-wide">Total cost</p>
                  <p className="text-[20px] font-bold text-blue-700 mt-0.5">${usage.total_cost_usd.toFixed(4)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-3 text-center">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Input</p>
                  <p className="text-[15px] font-bold text-gray-700 mt-0.5">{(usage.total_input / 1000).toFixed(1)}k</p>
                  <p className="text-[10px] text-gray-400">tokens</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-3 text-center">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Output</p>
                  <p className="text-[15px] font-bold text-gray-700 mt-0.5">{(usage.total_output / 1000).toFixed(1)}k</p>
                  <p className="text-[10px] text-gray-400">tokens</p>
                </div>
              </div>
              {Object.keys(usage.by_endpoint).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-gray-400">By feature</p>
                  {Object.entries(usage.by_endpoint)
                    .sort(([, a], [, b]) => b.cost_usd - a.cost_usd)
                    .map(([ep, stat]) => (
                      <div key={ep} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-[13px] font-medium text-gray-700 capitalize">{ep.replace(/-/g, ' ')}</p>
                          <p className="text-[11px] text-gray-400">{stat.calls} call{stat.calls !== 1 ? 's' : ''}</p>
                        </div>
                        <p className="text-[13px] font-semibold text-gray-700">${stat.cost_usd.toFixed(4)}</p>
                      </div>
                    ))}
                </div>
              )}
              <p className="text-[11px] text-gray-400">Prices: $3.00/M input · $15.00/M output (claude-sonnet-4-6)</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">No usage recorded yet. Usage is tracked from your next API call.</p>
          )}
        </div>

        {message && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">{message}</div>}
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        <button onClick={save} disabled={saving || validatingKey} className="btn-primary disabled:opacity-50">
          {validatingKey ? 'Validating key…' : saving ? 'Saving…' : 'Save settings'}
        </button>

        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">Demo trips</h2>
          <p className="text-sm text-gray-500">Resets the Scotland 2026 and Lake Garda 2026 demo trips to their latest built-in data — useful after an app update adds new links or details to them.</p>
          <button onClick={resetDemoTrips} disabled={resetting} className="btn-secondary w-full disabled:opacity-50">
            {resetting ? 'Resetting…' : 'Reset demo trips to latest data'}
          </button>
          {resetMessage && <p className="text-sm text-gray-600">{resetMessage}</p>}
        </div>

        <div className="pt-4">
          <button onClick={signOut} className="w-full py-3 text-red-500 font-medium text-sm">Sign out</button>
        </div>
      </div>
    </div>
  )
}
