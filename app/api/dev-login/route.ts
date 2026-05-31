import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const email = process.env.DEV_EMAIL
  const password = process.env.DEV_PASSWORD

  if (!email || !password) {
    return NextResponse.redirect(new URL('http://localhost:3000/login'))
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.redirect(new URL('http://localhost:3000/login'))
  }

  return NextResponse.redirect(new URL('http://localhost:3000/'))
}
