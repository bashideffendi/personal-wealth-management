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
    return NextResponse.json({ items })
  } catch {
    // Graceful: never break the tab — return empty + error flag, status 200.
    return NextResponse.json({ items: [], error: true })
  }
}
