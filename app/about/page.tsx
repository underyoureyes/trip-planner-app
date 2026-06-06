import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'About — Trip Planner',
  description: 'AI-powered road trip planner. Tell Claude where you want to go — it builds your full itinerary.',
}

const features = [
  {
    icon: '✨',
    title: 'AI itinerary generation',
    desc: 'Describe your trip in plain English — or speak it. Claude builds a full day-by-day itinerary with drive legs, stops, hotels, eating recommendations and local tips.',
  },
  {
    icon: '📷',
    title: 'Scan booking confirmations',
    desc: 'Photograph your hotel or activity booking and Claude extracts the details — check-in times, booking references and addresses — directly into your trip.',
  },
  {
    icon: '📊',
    title: 'Import from spreadsheet',
    desc: 'Upload a .xlsx or .csv from OneDrive or your device. Claude reads your existing bookings and pre-fills the trip form, shifting any past dates forward automatically.',
  },
  {
    icon: '🗺️',
    title: 'Day-by-day navigation',
    desc: 'Every stop has a Navigate button that opens Google Maps or Apple Maps. A full route card shows all hotels and per-day driving routes.',
  },
  {
    icon: '✏️',
    title: 'Live trip editing',
    desc: 'Swipe to delete any stop. Tap + on a day to add a stop by description, voice, or by scanning a booking photo — Claude slots it in instantly.',
  },
  {
    icon: '🔗',
    title: 'Shareable trip links',
    desc: 'Share a read-only link to your itinerary with anyone — travel companions, family, friends — no account needed to view.',
  },
  {
    icon: '📱',
    title: 'Installs like a native app',
    desc: 'Add to your iPhone or Android home screen from Safari or Chrome. Works as a full-screen app with no browser chrome.',
  },
  {
    icon: '🔒',
    title: 'Private by default',
    desc: 'Trips are private to your account. Row-level security in Supabase ensures nobody can read or edit your data.',
  },
]

const stack = [
  { name: 'Next.js 14', role: 'App Router, React Server Components, API routes', color: '#000' },
  { name: 'Claude API', role: 'Trip generation, stop suggestions, booking vision, spreadsheet analysis', color: '#d97706' },
  { name: 'Supabase', role: 'Postgres database, row-level security auth, real-time', color: '#3ecf8e' },
  { name: 'TypeScript', role: 'Strict-mode end-to-end types', color: '#3178c6' },
  { name: 'Tailwind CSS', role: 'Mobile-first design with custom brand tokens', color: '#38bdf8' },
  { name: 'SheetJS', role: 'Client-side .xlsx / .csv parsing — no file upload needed', color: '#21a366' },
  { name: 'Vercel', role: 'Edge deployment, automatic HTTPS, CI/CD from GitHub', color: '#000' },
]

export default async function AboutPage({ searchParams }: { searchParams: { next?: string } }) {
  const nextUrl = searchParams.next ? `${searchParams.next}?from_about=1` : null

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = Boolean(user)

  return (
    <div className="min-h-screen bg-mist" style={{ paddingBottom: nextUrl ? 88 : 0 }}>

      {/* ── Hero ── */}
      <div className="bg-gradient-to-b from-[#1a1a2e] to-[#1e3a8a] px-6 pt-16 pb-14 text-center">
        <div className="flex justify-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-blue-200" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)' }}>
            Powered by Claude AI
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-amber-200" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)' }}>
            🧪 Beta
          </span>
        </div>
        <h1 className="font-serif text-4xl font-bold text-white leading-tight mb-3">
          Road trips planned<br />by AI
        </h1>
        <p className="text-blue-200 text-[16px] leading-relaxed max-w-sm mx-auto">
          Tell Claude where you want to go, how long you have, and what you love. Get a complete day-by-day itinerary in seconds.
        </p>
      </div>

      <div className="px-4 pt-8 pb-20 max-w-lg mx-auto space-y-8">

        {/* ── What it does ── */}
        <section>
          <p className="text-[11px] font-bold tracking-[2px] uppercase text-soft mb-4">What it does</p>
          <div className="space-y-3">
            {features.map(f => (
              <div key={f.title} className="bg-white rounded-card px-4 py-4 flex gap-4 items-start" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.08)' }}>
                <span className="text-[24px] flex-shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <p className="font-semibold text-[14px] text-ink leading-snug">{f.title}</p>
                  <p className="text-[13px] text-soft leading-snug mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section>
          <p className="text-[11px] font-bold tracking-[2px] uppercase text-soft mb-4">How it works</p>
          <div className="bg-white rounded-card px-5 py-5 space-y-5" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.08)' }}>
            {[
              ['1', '#2563a8', 'Describe your trip', 'Type, speak, scan bookings, or import a spreadsheet. Tell Claude what you love — castles, distilleries, dog-friendly pubs, whatever.'],
              ['2', '#6b4f7a', 'Claude builds the itinerary', 'Claude generates a full day-by-day plan: drive legs, overnight stops, activities, eating spots and local tips tailored to your interests.'],
              ['3', '#2d6a4f', 'Navigate & share', 'Each stop has a Navigate button for turn-by-turn directions. Share a link so anyone on the trip can follow along.'],
            ].map(([num, color, title, desc]) => (
              <div key={num} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[14px]" style={{ background: color }}>
                  {num}
                </div>
                <div className="pt-0.5">
                  <p className="font-semibold text-[14px] text-ink leading-snug">{title}</p>
                  <p className="text-[13px] text-soft leading-snug mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tech stack ── */}
        <section>
          <p className="text-[11px] font-bold tracking-[2px] uppercase text-soft mb-4">Tech stack</p>
          <div className="bg-white rounded-card overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.08)' }}>
            {stack.map((t, i) => (
              <div key={t.name} className={`flex items-start gap-3 px-4 py-3.5 ${i < stack.length - 1 ? 'border-b border-line' : ''}`}>
                <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: t.color, border: t.color === '#000' ? '2px solid #d1d9e6' : undefined }} />
                <div>
                  <p className="font-semibold text-[13px] text-ink">{t.name}</p>
                  <p className="text-[12px] text-soft leading-snug">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Beta note ── */}
        <section>
          <div className="rounded-card px-4 py-4 flex gap-3 items-start" style={{ background: '#fef9ec', border: '1px solid #f6d860' }}>
            <span className="text-[20px] flex-shrink-0">🧪</span>
            <div>
              <p className="font-semibold text-[13px] text-amber-800 leading-snug">Beta — bring your own Claude API key</p>
              <p className="text-[12px] text-amber-700 leading-snug mt-0.5">
                This app is in beta testing. To generate itineraries you&apos;ll need a free{' '}
                <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="underline">Anthropic API key</a>
                {' '}— add it in Settings after signing up. You&apos;re billed directly by Anthropic at their standard rates (a typical trip costs a few cents).
              </p>
            </div>
          </div>
        </section>

        {/* ── Access ── */}
        {isLoggedIn ? (
          <section>
            <div className="bg-white rounded-card px-5 py-5 text-center space-y-3" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.08)' }}>
              <p className="font-semibold text-[15px] text-ink">You&apos;re signed in</p>
              <Link
                href="/trips"
                className="btn-primary inline-flex items-center gap-2"
                style={{ width: 'auto', paddingLeft: 24, paddingRight: 24 }}
              >
                🗺️ My trips →
              </Link>
            </div>
          </section>
        ) : (
          <section>
            <div className="bg-white rounded-card px-5 py-5 text-center space-y-3" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.08)' }}>
              <p className="font-semibold text-[15px] text-ink">Want access?</p>
              <p className="text-[13px] text-soft leading-snug">
                Access is by invite code. Email to request one — once you have it, registration takes 30 seconds.
              </p>
              <a
                href="mailto:d.castledine1971@gmail.com?subject=Trip%20Planner%20invite%20code"
                className="btn-primary inline-flex items-center gap-2"
                style={{ width: 'auto', paddingLeft: 24, paddingRight: 24 }}
              >
                ✉️ Email for invite code
              </a>
              <div className="flex justify-center gap-4 pt-1">
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-[12px] font-semibold text-[14px] text-white active:opacity-70"
                  style={{ background: '#2563a8' }}
                >
                  Get access
                </Link>
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-[12px] font-semibold text-[14px] text-[#1a1a2e] bg-white active:opacity-70"
                  style={{ border: '1.5px solid #d1d9e6' }}
                >
                  Sign in
                </Link>
              </div>
            </div>
          </section>
        )}

      </div>

      {/* ── Sticky "Continue to trip" bar — shown when arriving from a shared link ── */}
      {nextUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(to top, rgba(26,26,46,0.95) 60%, transparent)' }}>
          <Link
            href={nextUrl}
            className="flex items-center justify-center gap-2 w-full max-w-lg mx-auto rounded-[16px] py-4 font-bold text-[16px] text-white"
            style={{ background: 'linear-gradient(135deg, #2563a8 0%, #1e3a8a 100%)', boxShadow: '0 4px 20px rgba(37,99,168,0.5)' }}
          >
            View trip →
          </Link>
        </div>
      )}
    </div>
  )
}
