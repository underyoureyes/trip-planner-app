# Trip Planner App — Claude Code Project

## What this project does

An iPhone-first PWA for generating and viewing road trip itineraries. Users create a trip by filling in an intake form; Claude AI generates a full day-by-day itinerary which is saved to Supabase. The app works as a progressive web app — add to iPhone home screen for a native feel.

**Live app:** deployed on Vercel (connect `main` branch to a new Vercel project)

---

## Tech stack

- **Next.js 14** — App Router, React Server Components
- **Supabase** — Postgres database + Row Level Security auth
- **Claude API** (`claude-sonnet-4-6`) — streaming trip generation
- **Tailwind CSS** — mobile-first styling with `brand-*` colour tokens
- **TypeScript** — strict mode

---

## Project structure

```
trip-planner-app/
├── CLAUDE.md
├── app/
│   ├── layout.tsx              ← root layout, PWA meta tags
│   ├── page.tsx                ← home/redirect (server component)
│   ├── globals.css             ← Tailwind base + brand colours
│   ├── login/page.tsx          ← email/password login
│   ├── register/page.tsx       ← invite-code-gated registration
│   ├── setup/page.tsx          ← first-run profile setup (name, vehicle, home town)
│   ├── settings/page.tsx       ← Claude API key + preferences
│   ├── trips/
│   │   ├── page.tsx            ← trip list (server component)
│   │   ├── new/page.tsx        ← intake form → create trip
│   │   └── [id]/
│   │       ├── page.tsx        ← trip viewer (day tabs, stop cards, navigate buttons)
│   │       └── settings/page.tsx ← per-trip settings
│   └── api/
│       ├── me/route.ts         ← GET current user + profile
│       ├── settings/
│       │   ├── route.ts        ← GET/POST user settings (Claude key, units)
│       │   └── validate-key/route.ts ← POST validate Claude API key
│       └── trips/
│           ├── route.ts        ← GET list / POST create trip
│           └── [id]/
│               ├── route.ts    ← GET / PATCH / DELETE trip
│               ├── data/route.ts    ← GET/POST trip itinerary JSON
│               └── generate/route.ts ← POST stream Claude generation
├── components/trip/
│   ├── DayTabs.tsx             ← horizontal scrolling day selector
│   ├── StopCard.tsx            ← individual stop card (drive/hotel/activity etc)
│   └── NavigateButton.tsx      ← deep-links to Google Maps / Apple Maps / web
├── lib/
│   ├── types.ts                ← all TypeScript interfaces (Trip, Day, Stop, etc)
│   ├── claude.ts               ← Claude client, system prompt, streaming generator
│   ├── navigation.ts           ← Maps URL builders, stop type icons
│   ├── supabase.ts             ← browser client ONLY (createBrowserClient)
│   └── supabase-server.ts      ← server client ONLY (createServerClient + cookies)
├── public/
│   └── manifest.json           ← PWA manifest
├── supabase/
│   └── migrations/
│       └── 001_initial.sql     ← run this in Supabase SQL editor to create schema
├── .env.example                ← required env vars
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## Critical architecture note — Supabase split

**`lib/supabase.ts`** — browser client only. Import in client components (`'use client'`).
**`lib/supabase-server.ts`** — server client only. Import in server components and API routes.

**Never import `supabase-server.ts` in a client component** — it imports `next/headers` which will break the build. This is the most common mistake.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=      # Supabase project → Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase project → Settings → API → anon/public key
INVITE_CODE=TRIPPLAN2026        # required to register — change as needed
```

---

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # check for TypeScript/build errors before pushing
```

---

## Supabase setup

Run the SQL in `supabase/migrations/001_initial.sql` in the Supabase SQL editor to create all tables and RLS policies.

Tables: `profiles`, `user_settings`, `trips`, `trip_data`

Key RLS rules: users can only read/write their own rows. Shared trips (`is_shared = true`) are readable by anyone.

---

## Registration flow

1. `/register` — requires `INVITE_CODE` env var to match
2. On first login, redirected to `/setup` to complete profile
3. `/settings` — user adds their Claude API key (stored in Supabase `user_settings`)

---

## Trip generation flow

1. User fills intake form at `/trips/new`
2. POST `/api/trips` — creates trip record with `status: 'generating'`
3. POST `/api/trips/[id]/generate` — streams Claude response, saves JSON to `trip_data`
4. Trip `status` set to `'ready'`, redirect to `/trips/[id]`

---

## Navigation deep-links

`NavigateButton` opens native maps apps:
- `comgooglemaps://` — Google Maps app (falls back to web)
- `maps://maps.apple.com/` — Apple Maps
- `https://www.google.com/maps/dir/` — web fallback

---

## Deployment

Push `main` to Vercel. Required env vars must be set in Vercel project settings.
Production branch: `main`---

## Current state (as of June 2026)

### What's built
- All pages and API routes exist (login, register, setup, settings, trips list, new trip, trip viewer)
- Claude streaming generation works end-to-end
- NavigateButton deep-links to Google/Apple Maps
- Supabase auth + RLS in place

### What's NOT done yet
- Trip generation UI (no loading/progress indicator while Claude streams)
- No error handling UI if generation fails
- Trip sharing (`is_shared`) not wired up in the UI
- No editing of generated itinerary (stops are read-only)
- PWA install prompt not implemented
- No offline caching (service worker)

### Known issues
- None currently

### Deployed to
- Vercel: [your-app.vercel.app]
- Supabase project: [your-project-ref].supabase.co


