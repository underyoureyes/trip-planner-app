'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { IntakeForm } from '@/lib/types'

const CURRENT_YEAR = new Date().getFullYear()

function compressImage(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const MAX_W = 1200
        const scale = Math.min(1, MAX_W / img.width)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function NewTripPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ── Smart input state ──────────────────────────────────────────────────────
  const [tripDescription, setTripDescription] = useState('')
  const [listening,  setListening]  = useState(false)
  const [parsing,    setParsing]    = useState(false)
  const [parseMsg,   setParseMsg]   = useState('')
  const [scanning,   setScanning]   = useState(false)
  const [scanMsg,    setScanMsg]    = useState('')
  const [scannedFiles, setScannedFiles] = useState<string[]>([])  // thumbnails

  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const scanFileRef    = useRef<HTMLInputElement>(null)
  const descRef        = useRef<HTMLTextAreaElement>(null)

  const hasSpeech = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<Partial<IntakeForm>>({
    title: '', origin: '', destination: '', start_date: '', end_date: '',
    num_travellers: 2, interests: [], accommodation_style: 'mix',
    budget_per_day_gbp: 150, driving_max_hours: 4,
    preferred_check_in: '15:00', preferred_check_out: '10:00',
    must_include: '', notes: '', pets: '',
    emergency_prefs: ['a_and_e', 'walk_in', 'pharmacy'],
  })

  const emergencyOptions = [
    { id: 'a_and_e',   label: '🏥 A&E' },
    { id: 'walk_in',   label: '🚶 Walk-in' },
    { id: 'vet',       label: '🐾 Vet' },
    { id: 'pharmacy',  label: '💊 Pharmacy' },
    { id: 'breakdown', label: '🔧 Breakdown' },
  ]

  function toggleEmergencyPref(id: string) {
    const current = form.emergency_prefs || []
    setForm(f => ({ ...f, emergency_prefs: current.includes(id) ? current.filter(p => p !== id) : [...current, id] }))
  }

  const interestOptions = [
    { id: 'history',     label: '🏰 History' },
    { id: 'nature',      label: '🌿 Nature' },
    { id: 'food',        label: '🍽️ Food & Drink' },
    { id: 'adventure',   label: '🧗 Adventure' },
    { id: 'beaches',     label: '🏖️ Beaches' },
    { id: 'cities',      label: '🏙️ Cities' },
    { id: 'photography', label: '📸 Photography' },
    { id: 'wildlife',    label: '🦨 Wildlife' },
    { id: 'relaxation',  label: '🛀 Relaxation' },
    { id: 'nightlife',   label: '🎉 Nightlife' },
  ]

  function toggleInterest(id: string) {
    const current = form.interests || []
    setForm(f => ({ ...f, interests: current.includes(id) ? current.filter(i => i !== id) : [...current, id] }))
  }

  // ── Voice input ────────────────────────────────────────────────────────────

  function startListening() {
    if (!hasSpeech || listening) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.lang = 'en-GB'
    rec.interimResults = false
    rec.maxAlternatives = 1
    recognitionRef.current = rec
    setListening(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      setTripDescription(prev => prev ? `${prev} ${e.results[0][0].transcript}` : e.results[0][0].transcript)
      setListening(false)
    }
    rec.onerror = () => setListening(false)
    rec.onend   = () => setListening(false)
    rec.start()
  }

  function stopListening() { recognitionRef.current?.stop(); setListening(false) }

  // ── Parse description into form fields ─────────────────────────────────────

  async function parseDescription() {
    if (!tripDescription.trim() || parsing) return
    setParsing(true); setParseMsg('Reading your description…'); setError('')
    try {
      const res = await fetch('/api/parse-trip-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: tripDescription.trim() }),
      })
      const data = await res.json() as { fields?: Partial<IntakeForm>; error?: string }
      if (!res.ok || data.error) { setParseMsg(''); setError(data.error || 'Could not parse description'); return }
      if (data.fields) {
        setForm(f => ({ ...f, ...data.fields }))
        setParseMsg('✓ Form filled from your description — review and adjust below')
      }
    } catch {
      setParseMsg(''); setError('Network error — please try again')
    } finally {
      setParsing(false)
    }
  }

  // ── Scan booking photo ─────────────────────────────────────────────────────

  async function handleScanFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    e.target.value = ''
    setScanning(true); setScanMsg(`Scanning ${files.length > 1 ? `${files.length} photos` : 'photo'}…`); setError('')

    try {
      const results: string[] = []
      for (const file of files) {
        const dataUrl = await compressImage(file)
        // Store thumbnail for display
        results.push(dataUrl)
        const res = await fetch('/api/scan-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: dataUrl }),
        })
        const data = await res.json() as { fields?: Record<string, unknown>; error?: string }
        if (data.fields && Object.keys(data.fields).length > 0) {
          setForm(f => ({ ...f, ...data.fields }))
        }
      }
      setScannedFiles(prev => [...prev, ...results])
      setScanMsg(`✓ ${files.length > 1 ? `${files.length} bookings` : 'Booking'} scanned — details pre-filled below`)
    } catch {
      setScanMsg(''); setError('Scan failed — please try again')
    } finally {
      setScanning(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.title?.trim())       { setError('Give your trip a title');             return }
    if (!form.origin?.trim())      { setError('Enter your starting point');           return }
    if (!form.destination?.trim()) { setError('Enter your destination');              return }
    if (!form.start_date)          { setError('Choose a start date');                return }
    if (!form.end_date)            { setError('Choose an end date');                  return }
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      setError('End date must be after start date'); return
    }
    setSubmitting(true)
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, description: tripDescription.trim() || undefined }),
    })
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
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-white text-xl font-bold">Plan a new trip</h1>
            <p className="text-brand-200 text-xs mt-0.5">Claude will build your itinerary</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 pt-5 pb-32 space-y-5">

        {/* ── Smart input card ─────────────────────────────────────────── */}
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">✨ Describe your trip</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Tell Claude what you have in mind — or scan existing booking confirmations. Claude will fill in the form for you.
            </p>
          </div>

          {/* Voice / text description */}
          <div className="relative">
            <textarea
              ref={descRef}
              value={tripDescription}
              onChange={e => setTripDescription(e.target.value)}
              placeholder={'e.g. "A week driving around the Scottish Highlands in June, starting from Leeds. We\'re a couple who love castles, whisky distilleries and good food. Budget around £150/day."'}
              className="input-field resize-none pr-14"
              rows={4}
            />
            {hasSpeech && (
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                className="absolute right-3 bottom-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors active:opacity-70"
                style={{ background: listening ? '#2563a8' : '#e8edf5' }}
                title={listening ? 'Stop' : 'Speak your trip idea'}
              >
                <span className={`text-[20px] ${listening ? 'animate-pulse' : ''}`}>🎤</span>
              </button>
            )}
          </div>
          {listening && (
            <p className="text-[12px] text-blue-600 font-semibold text-center animate-pulse -mt-2">Listening… describe your trip</p>
          )}

          {/* Parse button */}
          {tripDescription.trim() && !parseMsg && (
            <button
              type="button"
              onClick={parseDescription}
              disabled={parsing}
              className="w-full py-3 rounded-xl font-semibold text-[15px] transition-opacity"
              style={{ background: '#2563a8', color: '#fff', opacity: parsing ? 0.6 : 1 }}
            >
              {parsing
                ? <span className="flex items-center justify-center gap-2"><span className="animate-spin inline-block">⏳</span> Reading description…</span>
                : '✨ Fill form from description'}
            </button>
          )}
          {parseMsg && (
            <p className="text-[13px] font-medium" style={{ color: parseMsg.startsWith('✓') ? '#2d6a4f' : '#374151' }}>
              {parseMsg}
            </p>
          )}

          {/* Scan bookings */}
          <button
            type="button"
            onClick={() => scanFileRef.current?.click()}
            disabled={scanning}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-colors active:bg-gray-50"
            style={{ borderColor: scanning ? '#2563a8' : '#d1d5db' }}
          >
            <span className="text-[22px]">{scanning ? '⏳' : '📷'}</span>
            <div className="text-left">
              <p className="text-[13px] font-semibold text-gray-800 leading-tight">
                {scanning ? 'Scanning…' : 'Scan booking confirmations'}
              </p>
              <p className="text-[11px] text-gray-400 leading-tight">Photos of hotel, activity or flight confirmations</p>
            </div>
          </button>

          <input ref={scanFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleScanFiles} />

          {/* Scanned thumbnails */}
          {scannedFiles.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {scannedFiles.map((src, i) => (
                <img key={i} src={src} alt="Scanned booking" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
              ))}
            </div>
          )}
          {scanMsg && (
            <p className="text-[13px] font-medium" style={{ color: scanMsg.startsWith('✓') ? '#2d6a4f' : '#374151' }}>
              {scanMsg}
            </p>
          )}

        </div>

        {/* ── Trip details ─────────────────────────────────────────────── */}
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Travellers: <span className="text-brand-600 font-semibold">{form.num_travellers}</span>
            </label>
            <input type="range" min={1} max={8} value={form.num_travellers}
              onChange={e => setForm(f => ({ ...f, num_travellers: Number(e.target.value) }))}
              className="w-full accent-brand-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1</span><span>8</span></div>
          </div>
        </div>

        {/* ── Hotel preferences — hidden for camping ────────────────────── */}
        {form.accommodation_style !== 'camping' && <div className="card space-y-4">
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
        </div>}

        {/* ── Interests ────────────────────────────────────────────────── */}
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

        {/* ── Accommodation & budget ───────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 text-base">Accommodation &amp; budget</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Accommodation style</label>
            <div className="grid grid-cols-2 gap-2">
              {([['budget', '🏕️ Budget'], ['mid', '🏨 Mid-range'], ['luxury', '🏰 Luxury'], ['mix', '🎲 Mix it up'], ['camping', '⛺ Camping']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setForm(f => ({ ...f, accommodation_style: val }))}
                  className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    form.accommodation_style === val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-700'
                  }`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Daily budget: <span className="text-brand-600 font-semibold">£{form.budget_per_day_gbp}</span>
            </label>
            <input type="range" min={50} max={500} step={25} value={form.budget_per_day_gbp}
              onChange={e => setForm(f => ({ ...f, budget_per_day_gbp: Number(e.target.value) }))}
              className="w-full accent-brand-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>£50</span><span>£500</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Max driving/day: <span className="text-brand-600 font-semibold">{form.driving_max_hours}h</span>
            </label>
            <input type="range" min={1} max={10} value={form.driving_max_hours}
              onChange={e => setForm(f => ({ ...f, driving_max_hours: Number(e.target.value) }))}
              className="w-full accent-brand-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1h</span><span>10h</span></div>
          </div>
        </div>

        {/* ── Extra details ────────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 text-base">Extra details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Must-include stops</label>
            <textarea value={form.must_include} onChange={e => setForm(f => ({ ...f, must_include: e.target.value }))}
              className="input-field resize-none" rows={3} placeholder="e.g. Loch Ness, Glencoe, Isle of Skye" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              🐾 Travelling with pets? <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input type="text" value={form.pets} onChange={e => {
              const val = e.target.value
              setForm(f => {
                const prefs = f.emergency_prefs || []
                return { ...f, pets: val, emergency_prefs: val.trim() && !prefs.includes('vet') ? [...prefs, 'vet'] : prefs }
              })
            }}
              className="input-field" placeholder="e.g. 2 dogs" />
            <p className="text-xs text-gray-400 mt-1">Claude will mark dog-friendly stops and add vet contacts for each overnight location</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🆘 Emergency contacts to include <span className="text-gray-400 font-normal">(per overnight location)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {emergencyOptions.map(opt => {
                const active = (form.emergency_prefs || []).includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleEmergencyPref(opt.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      active ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >{opt.label}</button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Police always included. Claude will find the nearest of each type for every stop on the route.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Other notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input-field resize-none" rows={3} placeholder="e.g. vegetarian-friendly, avoid motorways" />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
          {submitting ? 'Creating trip…' : '✨ Generate itinerary'}
        </button>
      </form>
    </div>
  )
}
