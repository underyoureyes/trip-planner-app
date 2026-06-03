'use client'
import { useEffect, useRef, useState } from 'react'
import type { Trip, TripData } from '@/lib/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  trip: Trip
  tripData: TripData
}

interface RouteStop {
  label: string
  hotel?: string
  date?: string
  driveKmToNext?: number
  highlight: boolean
  isFirst: boolean
  isLast: boolean
}

function clamp(text: string, ctx: CanvasRenderingContext2D, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

function buildStops(trip: Trip, tripData: TripData): RouteStop[] {
  const days = tripData.days || []
  const stops: RouteStop[] = []

  const origin = trip.intake_form?.origin?.split(',')[0]?.trim() || ''
  if (origin) {
    stops.push({ label: origin, highlight: false, isFirst: true, isLast: false })
  }

  days.forEach((day, i) => {
    const hotel = day.stops.find(s => s.type === 'hotel')
    const driveKm = day.stops
      .filter(s => s.type === 'drive')
      .reduce((a, s) => a + (s.distance_km || 0), 0)

    // Assign drive km to the PREVIOUS stop (distance to get here)
    if (stops.length > 0 && driveKm > 0) {
      stops[stops.length - 1].driveKmToNext = Math.round(driveKm)
    }

    const location = day.overnight_location || hotel?.name || `Day ${day.day_number}`
    const hotelName = hotel?.name && hotel.name !== location ? hotel.name : undefined
    const isLast = i === days.length - 1

    stops.push({
      label: location,
      hotel: hotelName,
      date: day.date,
      highlight: day.highlight === true,
      isFirst: false,
      isLast,
    })
  })

  // Ensure only the last entry is marked isLast
  if (stops.length > 1 && !stops[stops.length - 1].isLast) {
    stops[stops.length - 1].isLast = true
  }

  return stops
}

function drawCard(canvas: HTMLCanvasElement, trip: Trip, tripData: TripData) {
  const stops = buildStops(trip, tripData)
  if (stops.length === 0) return

  const W       = 1080
  const PAD     = 72
  const HDR_H   = 230
  const STOP_H  = 118
  const FTR_H   = 110
  const H       = HDR_H + stops.length * STOP_H + FTR_H

  canvas.width  = W
  canvas.height = H

  const ctx = canvas.getContext('2d')!

  // ── Background ──────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0,   '#0a0a18')
  bg.addColorStop(0.5, '#111827')
  bg.addColorStop(1,   '#0f1e35')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.035)'
  for (let x = PAD; x < W - PAD; x += 54) {
    for (let y = HDR_H - 30; y < H - FTR_H + 30; y += 54) {
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill()
    }
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  ctx.textAlign = 'center'

  // Title
  ctx.font = 'bold 64px "Playfair Display", Georgia, "Times New Roman", serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(clamp(trip.title, ctx, W - 140), W / 2, 88)

  // Subtitle row
  const subtitleParts: string[] = []
  if (trip.start_date && trip.end_date) {
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    subtitleParts.push(`${fmt(trip.start_date)} – ${fmt(trip.end_date)}`)
  }
  if (tripData.total_days)         subtitleParts.push(`${tripData.total_days} days`)
  if (tripData.total_distance_km)  subtitleParts.push(`~${tripData.total_distance_km} km`)
  if (trip.intake_form?.num_travellers && trip.intake_form.num_travellers > 1)
    subtitleParts.push(`${trip.intake_form.num_travellers} travellers`)

  ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.52)'
  ctx.fillText(subtitleParts.join('  ·  '), W / 2, 138)

  // Header divider
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, 175); ctx.lineTo(W - PAD, 175); ctx.stroke()

  // Origin → Destination label
  if (trip.intake_form?.origin && trip.intake_form?.destination) {
    const o = trip.intake_form.origin.split(',')[0].trim()
    const d = trip.intake_form.destination.split(',')[0].trim()
    ctx.font = 'bold 22px -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    ctx.fillText(`${o}  →  ${d}`, W / 2, 208)
  }

  // ── Route ───────────────────────────────────────────────────────────────────
  const ROUTE_X = PAD + 28
  const FIRST_Y = HDR_H + 36

  // Vertical dashed route line
  const lineBot = FIRST_Y + (stops.length - 1) * STOP_H + 22
  const lineGrad = ctx.createLinearGradient(0, FIRST_Y, 0, lineBot)
  lineGrad.addColorStop(0, 'rgba(45,106,79,0.7)')
  lineGrad.addColorStop(0.4, 'rgba(37,99,168,0.7)')
  lineGrad.addColorStop(1, 'rgba(201,150,58,0.7)')
  ctx.strokeStyle = lineGrad
  ctx.lineWidth = 3
  ctx.setLineDash([14, 9])
  ctx.beginPath()
  ctx.moveTo(ROUTE_X, FIRST_Y + 22)
  ctx.lineTo(ROUTE_X, lineBot)
  ctx.stroke()
  ctx.setLineDash([])

  // ── Stops ───────────────────────────────────────────────────────────────────
  stops.forEach((stop, i) => {
    const cy = FIRST_Y + i * STOP_H + 22   // circle centre y
    const TEXT_X = ROUTE_X + 52

    // Pin colour
    let pinFill   = '#2563a8'
    let pinStroke = 'rgba(147,197,253,0.7)'
    if (stop.isFirst)   { pinFill = '#2d6a4f'; pinStroke = 'rgba(110,231,183,0.7)' }
    if (stop.isLast)    { pinFill = '#b45309'; pinStroke = 'rgba(253,211,77,0.7)' }
    if (stop.highlight && !stop.isFirst && !stop.isLast)
                        { pinFill = '#7c3aed'; pinStroke = 'rgba(196,181,253,0.7)' }

    const R = (stop.isFirst || stop.isLast) ? 24 : 20

    // Drop shadow
    ctx.shadowColor   = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur    = 10
    ctx.shadowOffsetY = 3

    // Circle fill
    ctx.beginPath(); ctx.arc(ROUTE_X, cy, R, 0, Math.PI * 2)
    ctx.fillStyle = pinFill; ctx.fill()
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0

    // Circle border
    ctx.strokeStyle = pinStroke; ctx.lineWidth = 3; ctx.stroke()

    // Label inside circle
    ctx.font = `bold ${(stop.isFirst || stop.isLast) ? 19 : 16}px -apple-system, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    if (stop.isFirst) ctx.fillText('S', ROUTE_X, cy + 7)
    else if (stop.isLast) ctx.fillText('F', ROUTE_X, cy + 7)
    else ctx.fillText(String(i), ROUTE_X, cy + 6)

    // Location name
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.fillText(clamp(stop.label, ctx, W - TEXT_X - PAD - 10), TEXT_X, cy + 4)

    // Date + hotel sub-line
    const sub: string[] = []
    if (stop.date)  sub.push(new Date(stop.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))
    if (stop.hotel) sub.push(stop.hotel)
    if (sub.length > 0) {
      ctx.font = '23px -apple-system, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.48)'
      ctx.fillText(clamp(sub.join('  ·  '), ctx, W - TEXT_X - PAD - 10), TEXT_X, cy + 34)
    }

    // Drive km to next stop
    if (stop.driveKmToNext && stop.driveKmToNext > 0 && !stop.isLast) {
      ctx.font = '20px -apple-system, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.textAlign = 'center'
      ctx.fillText(`↓  ${stop.driveKmToNext} km`, ROUTE_X, cy + STOP_H - 12)
    }
  })

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footerY = HDR_H + stops.length * STOP_H + 18

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, footerY); ctx.lineTo(W - PAD, footerY); ctx.stroke()

  const fparts: string[] = []
  if (tripData.total_days)         fparts.push(`${tripData.total_days} days`)
  if (tripData.total_stops)        fparts.push(`${tripData.total_stops} stops`)
  if (tripData.total_distance_km)  fparts.push(`${tripData.total_distance_km} km`)
  if (trip.intake_form?.pets)      fparts.push(`🐾 ${trip.intake_form.pets}`)

  ctx.font = '26px -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.textAlign = 'center'
  ctx.fillText(fparts.join('  ·  '), W / 2, footerY + 42)

  ctx.font = 'bold 19px -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillText('Created with Trip Planner', W / 2, footerY + 78)
}

export default function TripRouteCard({ isOpen, onClose, trip, tripData }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [visible,  setVisible]  = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setVisible(true), 10)
      document.fonts.ready.then(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        drawCard(canvas, trip, tripData)
        setImageUrl(canvas.toDataURL('image/png'))
      })
    } else {
      setVisible(false)
      setImageUrl(null)
    }
  }, [isOpen, trip, tripData])

  if (!isOpen) return null

  const filename = `${trip.title.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}-route.png`

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: visible ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl"
        style={{
          maxHeight: '92vh',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-1 pb-3.5 border-b border-line">
          <div>
            <h2 className="font-serif text-[20px] text-ink">Route card</h2>
            <p className="text-[12px] text-soft">📱 Long press image → Save to Photos · or tap Download</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-mist text-soft flex items-center justify-center text-lg leading-none active:bg-line"
          >×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 pt-4 pb-8" style={{ maxHeight: 'calc(92vh - 96px)' }}>
          {/* Off-screen canvas for drawing */}
          <canvas ref={canvasRef} style={{ position: 'absolute', left: -9999, top: -9999 }} />

          {!imageUrl ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: '#d1d9e6', borderTopColor: '#2563a8' }}
              />
              <p className="text-soft text-[14px]">Generating route card…</p>
            </div>
          ) : (
            <>
              <img
                src={imageUrl}
                alt="Trip route card"
                className="w-full rounded-2xl shadow-xl mb-4"
                style={{ border: '1px solid #e8edf5' }}
              />
              <a
                href={imageUrl}
                download={filename}
                className="btn-primary block text-center no-underline mb-2"
              >
                ↓ Download image
              </a>
              <p className="text-center text-[11px] text-soft">
                On iPhone: long press the image above then tap <strong>Save to Photos</strong>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
