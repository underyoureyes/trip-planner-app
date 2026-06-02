'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { IntakeForm } from '@/lib/types'

const CURRENT_YEAR = new Date().getFullYear()

export default function NewTripPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Partial<IntakeForm>>({
    title: '', origin: '', destination: '', start_date: '', end_date: '',
    num_travellers: 2, interests: [], accommodation_style: 'mix',
    budget_per_day_gbp: 150, driving_max_hours: 4,
    preferred_check_in: '15:00', preferred_check_out: '10:00',
    must_include: '', notes: '', pets: '',
  })

  const interestOptions = [
    { id: 'history', label: '🏰 History' }, { id: 'nature', label: '🌿 Nature' },
    { id: 'food', label: '🍽️ Food & Drink' }, { id: 'adventure', label: '🧗 Adventure' },
    { id: 'beaches', label: '🏖️ Beaches' }, { id: 'cities', label: '🏙️ Cities' },
    { id: 'photography', label: '📸 Photography' }, { id: 'wildlife', label: '🦨 Wildlife' },
    { id: 'relaxation', label: '🛀 Relaxation' }, { id: 'nightlife', label: '🎉 Nightlife' },
  ]

  function toggleInterest(id: string) {
    const current = form.interests || []
    setForm(f => ({ ...f, interests: current.includes(id) ? current.filter(i => i !== id) : [...current, id] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.title?.trim()) { setError('Give your trip a title'); return }
    if (!form.origin?.trim()) { setError('Enter your starting point'); return }
    if (!form.destination?.trim()) { setError('Enter your destination'); return }
    if (!form.start_date) { setError('Choose a start date'); return }
    if (!form.end_date) { setError('Choose an end date'); return }
    if (new Date(form.end_date) <= new Date(form.start_date)) { setError('End date must be after start date'); return }
    setSubmitting(true)
    const res = await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error || 'Failed to create trip')
      setSubmitting(false)
      return
    }
    const { id } = await res.json()
    router.push(`/trips/${id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-brand-900 to-brand-700 px-6 pt-14 pb-6">
        <div className="flex items-center gap-3">
          <Link href="/trips" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div>
            <h1 className="text-white text-xl font-bold">Plan a new trip</h1>
            <p className="text-brand-200 text-xs mt-0.5">Claude will build your itinerary</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 pt-6 pb-32 space-y-5">
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 text-base">Trip details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Trip name</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field" placeholder={`Scotland ${CURRENT_YEAR}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">From</label>
              <input type="text" value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
                className="input-field" placeholder="Manchester, UK" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">To</label>
              <input type="text" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                className="input-field" placeholder="Edinburgh, UK" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="input-field" min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">End date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="input-field" min={form.start_date || new Date().toISOString().split('T')[0]} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Travellers: <span className="text-brand-600 font-semibold">{form.num_travellers}</span></label>
            <input type="range" min={1} max={8} value={form.num_travellers}
              onChange={e => setForm(f => ({ ...f, num_travellers: Number(e.target.value) }))}
              className="w-full accent-brand-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1</span><span>8</span></div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 text-base">🏨 Hotel preferences</h2>
          <p className="text-sm text-gray-500 -mt-2">Claude will use these times for all accommodation</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-in time</label>
              <input type="time" value={form.preferred_check_in}
                onChange={e => setForm(f => ({ ...f, preferred_check_in: e.target.value }))}
                className="input-field" />
              <p className="text-xs text-gray-400 mt-1">Default: 15:00</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-out time</label>
              <input type="time" value={form.preferred_check_out}
                onChange={e => setForm(f => ({ ...f, preferred_check_out: e.target.value }))}
                className="input-field" />
              <p className="text-xs text-gray-400 mt-1">Default: 10:00</p>
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900 text-base">Interests</h2>
          <p className="text-sm text-gray-500">Claude uses these to suggest optional bonus stops</p>
          <div className="flex flex-wrap gap-2">
            {interestOptions.map(opt => (
              <button key={opt.id} type="button" onClick={() => toggleInterest(opt.id)}
                className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                  (form.interests || []).includes(opt.id)
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}>{opt.label}</button>
            ))}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 text-base">Accommodation &amp; budget</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Accommodation style</label>
            <div className="grid grid-cols-2 gap-2">
              {([['budget', '🏕️ Budget'], ['mid', '🏨 Mid-range'], ['luxury', '🏰 Luxury'], ['mix', '🎲 Mix it up']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setForm(f => ({ ...f, accommodation_style: val }))}
                  className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    form.accommodation_style === val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-700'
                  }`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily budget: <span className="text-brand-600 font-semibold">£{form.budget_per_day_gbp}</span></label>
            <input type="range" min={50} max={500} step={25} value={form.budget_per_day_gbp}
              onChange={e => setForm(f => ({ ...f, budget_per_day_gbp: Number(e.target.value) }))}
              className="w-full accent-brand-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>£50</span><span>£500</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Max driving/day: <span className="text-brand-600 font-semibold">{form.driving_max_hours}h</span></label>
            <input type="range" min={1} max={10} value={form.driving_max_hours}
              onChange={e => setForm(f => ({ ...f, driving_max_hours: Number(e.target.value) }))}
              className="w-full accent-brand-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1h</span><span>10h</span></div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 text-base">Extra details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Must-include stops</label>
            <textarea value={form.must_include} onChange={e => setForm(f => ({ ...f, must_include: e.target.value }))}
              className="input-field resize-none" rows={3} placeholder="e.g. Loch Ness, Glencoe, Isle of Skye" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">🐾 Travelling with pets? <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={form.pets} onChange={e => setForm(f => ({ ...f, pets: e.target.value }))}
              className="input-field" placeholder="e.g. 2 dogs" />
            <p className="text-xs text-gray-400 mt-1">Claude will mark dog-friendly stops and include vet contacts</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Other notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input-field resize-none" rows={3} placeholder="e.g. vegetarian-friendly, avoid motorways" />
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
          {submitting ? 'Creating trip…' : '✨ Generate itinerary'}
        </button>
      </form>
    </div>
  )
}
