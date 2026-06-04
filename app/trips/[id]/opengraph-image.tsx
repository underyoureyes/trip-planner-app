import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: { id: string } }) {
  let title = 'Road Trip Itinerary'
  let subtitle = 'View the full day-by-day itinerary'

  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/trips?id=eq.${params.id}&select=title,start_date,end_date,intake_form,is_shared`
    const res = await fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
    })
    const rows = await res.json() as Array<{
      title: string
      start_date?: string
      end_date?: string
      is_shared?: boolean
      intake_form?: { destination?: string }
    }>
    const trip = rows[0]
    if (trip?.is_shared) {
      title = trip.title
      const dest = trip.intake_form?.destination
      const fmt = (d?: string) =>
        d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
      const dates = [fmt(trip.start_date), fmt(trip.end_date)].filter(Boolean).join(' – ')
      subtitle = [dest, dates].filter(Boolean).join('  ·  ') || subtitle
    }
  } catch { /* fall back to defaults */ }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(160deg, #0d0d1f 0%, #1a1a2e 50%, #1e3a5f 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'Georgia, "Times New Roman", serif',
          position: 'relative',
        }}
      >
        {/* subtle dot grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        <div style={{ fontSize: 72, marginBottom: 28 }}>🗺️</div>

        <div style={{
          fontSize: 72,
          fontWeight: 700,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.15,
          marginBottom: 24,
          maxWidth: 960,
        }}>
          {title}
        </div>

        <div style={{
          fontSize: 34,
          color: 'rgba(255,255,255,0.65)',
          textAlign: 'center',
          maxWidth: 800,
        }}>
          {subtitle}
        </div>

        <div style={{
          position: 'absolute',
          bottom: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'rgba(255,255,255,0.35)',
          fontSize: 22,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          Trip Planner
        </div>
      </div>
    ),
    { ...size }
  )
}
