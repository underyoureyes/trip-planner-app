'use client'

import { useState, useEffect, useRef } from 'react'
import type { Stop } from '@/lib/types'

interface Props {
  tripId: string
  dayIndex: number
  dayTitle: string
  isOpen: boolean
  onClose: () => void
  onAdd: (stop: Stop) => void
}

const SUGGESTIONS = [
  { label: '☕ Coffee stop',  command: 'Add a nice coffee shop or café near the route' },
  { label: '🐾 Dog walk',    command: 'Find a good dog walking spot or country park' },
  { label: '📸 Viewpoint',   command: 'Add a scenic viewpoint or photo stop' },
  { label: '🍺 Local pub',   command: 'Add a traditional local pub for a drink' },
  { label: '⛽ Fuel stop',   command: 'Add a petrol station fuel stop' },
  { label: '🍽 Lunch spot',  command: 'Find a good place for lunch' },
]

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

export default function AddStopSheet({ tripId, dayIndex, dayTitle, isOpen, onClose, onAdd }: Props) {
  const [command,   setCommand]   = useState('')
  const [listening, setListening] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [scanning,  setScanning]  = useState(false)
  const [preview,   setPreview]   = useState<Stop | null>(null)
  const [error,     setError]     = useState('')
  const [visible,   setVisible]   = useState(false)

  const textRef        = useRef<HTMLTextAreaElement>(null)
  const scanFileRef    = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)

  // Animate in
  useEffect(() => {
    if (isOpen) setTimeout(() => { setVisible(true); textRef.current?.focus() }, 10)
    else         setVisible(false)
  }, [isOpen])

  // Reset state after close animation
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setCommand(''); setPreview(null); setError('')
        setLoading(false); setListening(false); setScanning(false)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const hasSpeech = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

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
    rec.onresult = (e: any) => { setCommand(e.results[0][0].transcript); setListening(false) }
    rec.onerror  = () => setListening(false)
    rec.onend    = () => setListening(false)
    rec.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  async function handleGenerate() {
    if (!command.trim() || loading) return
    setLoading(true); setError(''); setPreview(null)
    try {
      const res  = await fetch(`/api/trips/${tripId}/add-stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayIndex, command: command.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to generate stop'); return }
      setPreview(data.stop)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanning(true); setError(''); setPreview(null); setCommand('')

    try {
      const dataUrl = await compressImage(file)
      const res = await fetch(`/api/trips/${tripId}/scan-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: dataUrl, stopType: 'hotel' }),
      })
      const { updates } = await res.json() as { updates: Record<string, string> }

      if (!updates || !updates.name) {
        setError('Could not read booking details — try a clearer photo')
        return
      }

      const stop: Stop = {
        name: updates.name,
        type: updates.check_in ? 'hotel' : 'other',
        ...(updates.address     && { address:     updates.address }),
        ...(updates.phone       && { phone:       updates.phone }),
        ...(updates.check_in    && { check_in:    updates.check_in }),
        ...(updates.check_out   && { check_out:   updates.check_out }),
        ...(updates.booking_ref && { booking_ref: updates.booking_ref }),
        ...(updates.website     && { website:     updates.website }),
        ...(updates.notes       && { notes:       updates.notes }),
      }
      setPreview(stop)
    } catch {
      setError('Scan failed — please try again')
    } finally {
      setScanning(false)
    }
  }

  function handleConfirm() {
    if (!preview) return
    onAdd(preview)
    onClose()
  }

  if (!isOpen) return null

  const durLabel = (mins?: number) => {
    if (!mins) return null
    return mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h${mins%60 ? ` ${mins%60}m` : ''}`
  }

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl"
        style={{
          maxHeight: '90vh',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>

        <div className="px-5 pb-10 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 24px)' }}>
          {/* Header */}
          <div className="flex items-center justify-between mt-2 mb-4">
            <div>
              <h2 className="font-serif text-[20px] text-ink leading-tight">Add a stop</h2>
              <p className="text-[12px] text-soft">Day {dayIndex + 1}{dayTitle ? ` · ${dayTitle}` : ''}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-mist text-soft flex items-center justify-center text-lg leading-none active:bg-line">×</button>
          </div>

          {/* Scan booking button */}
          <button
            onClick={() => scanFileRef.current?.click()}
            disabled={scanning || loading}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-card border-2 border-dashed mb-3 transition-colors active:bg-mist"
            style={{ borderColor: scanning ? '#2563a8' : '#d1d9e6' }}
          >
            <span className="text-[22px]">{scanning ? '⏳' : '📷'}</span>
            <div className="text-left">
              <p className="text-[14px] font-semibold text-ink">
                {scanning ? 'Reading booking…' : 'Scan a booking confirmation'}
              </p>
              <p className="text-[11px] text-soft">
                {scanning ? 'Claude is extracting the details' : 'Photo or screenshot of hotel, activity etc.'}
              </p>
            </div>
          </button>
          <input
            ref={scanFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleScanFile}
          />

          {/* Divider */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-line" />
            <span className="text-[11px] text-soft font-medium uppercase tracking-wider">or describe it</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          {/* Text input + mic */}
          <div className="relative mb-3">
            <textarea
              ref={textRef}
              value={command}
              onChange={e => { setCommand(e.target.value); if (preview) setPreview(null) }}
              placeholder={'e.g. "Add a whisky distillery near the route"\nor "Find a dog-friendly café for lunch"'}
              className="w-full rounded-card border border-line px-4 py-3 pr-14 text-[14px] text-ink leading-snug focus:outline-none focus:ring-2 focus:ring-sky focus:border-transparent resize-none bg-white"
              rows={3}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
            />
            {hasSpeech && (
              <button
                onClick={listening ? stopListening : startListening}
                className="absolute right-3 bottom-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors active:opacity-70"
                style={{ background: listening ? '#2563a8' : '#e8edf5' }}
                title={listening ? 'Stop listening' : 'Speak your command'}
              >
                <span className={`text-[18px] ${listening ? 'animate-pulse' : ''}`}>🎤</span>
              </button>
            )}
          </div>
          {listening && (
            <p className="text-[12px] text-sky font-semibold mb-3 text-center animate-pulse">Listening… speak now</p>
          )}

          {/* Quick suggestions */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SUGGESTIONS.map(s => (
              <button
                key={s.label}
                onClick={() => { setCommand(s.command); setPreview(null) }}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors"
                style={{
                  background: command === s.command ? '#dbeafe' : '#e8edf5',
                  color:      command === s.command ? '#2563a8' : '#475569',
                }}
              >{s.label}</button>
            ))}
          </div>

          {/* Generate button */}
          {!preview && (
            <button
              onClick={handleGenerate}
              disabled={!command.trim() || loading}
              className="w-full py-3.5 rounded-card font-semibold text-[15px] transition-opacity"
              style={{ background: '#2563a8', color: '#fff', opacity: !command.trim() || loading ? 0.45 : 1 }}
            >
              {loading
                ? <span className="flex items-center justify-center gap-2"><span className="inline-block animate-spin">⏳</span> Generating…</span>
                : '✨ Generate with Claude'}
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg px-4 py-3 mt-3 text-[13px] leading-snug" style={{ background: '#fee2e2', color: '#991b1b' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="mt-1">
              <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-soft mb-2">Preview</p>
              <div className="border border-line rounded-card p-4 bg-white" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.08)' }}>
                <p className="font-semibold text-[15px] text-ink mb-1">{preview.name}</p>
                {preview.description && (
                  <p className="text-[13px] text-soft leading-snug mb-2">{preview.description}</p>
                )}
                {preview.address && (
                  <p className="text-[12px] text-soft mb-1">📍 {preview.address}</p>
                )}
                {preview.check_in && (
                  <p className="text-[12px] text-soft mb-1">🛏️ Check-in {preview.check_in} · Out {preview.check_out}</p>
                )}
                {preview.booking_ref && (
                  <p className="text-[12px] font-mono text-ink mb-1">🎟️ {preview.booking_ref}</p>
                )}
                {preview.duration_mins && (
                  <p className="text-[12px] text-soft mb-2">⏱ {durLabel(preview.duration_mins)}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {preview.website && (
                    <span className="stop-link-green text-[11px]">🌐 {preview.website_label || 'Website'}</span>
                  )}
                  {preview.dog_friendly && (
                    <span className="inline-block text-[10px] bg-[#d8f3dc] text-[#2d6a4f] px-2 py-0.5 rounded-full font-semibold border border-[#b7e4c7]">🐾 Dog friendly</span>
                  )}
                  {preview.notes && (
                    <span className="text-[11px] text-soft italic">💡 {preview.notes}</span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-3">
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 rounded-card font-semibold text-[15px] active:opacity-90"
                  style={{ background: '#2d6a4f', color: '#fff' }}
                >
                  ✓ Add to Day {dayIndex + 1}
                </button>
                <button
                  onClick={() => { setPreview(null); setCommand('') }}
                  className="flex-1 py-3 rounded-card font-semibold text-[15px] border border-line text-soft active:bg-mist"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
