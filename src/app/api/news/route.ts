import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllNews } from '@/lib/invest/news'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { items } = await getAllNews()
    // Authed → private; 60s biar remount cepat skip auth+reassembly (RSS sendiri
    // udah di-cache via next revalidate:600 di getAllNews). [performance-5]
    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch (err) {
    // Graceful: never break the tab — return empty + error flag, status 200.
    // Log so a persistently-broken feed (e.g. missing key) is visible, not silent.
    console.error('[news] getAllNews failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ items: [], error: true })
  }
}
