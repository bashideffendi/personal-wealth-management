import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Health check publik buat uptime monitor eksternal (BetterStack/UptimeRobot).
 * Ping ringan: HEAD count ke tabel kecil `plans`. Tanpa auth, tanpa data sensitif.
 * 200 = sehat, 503 = DB down. `db: 'unknown'` = service-role belum di-set (lokal).
 */
export async function GET() {
  const started = Date.now()
  let db: 'ok' | 'down' | 'unknown' = 'unknown'

  try {
    const admin = createAdminClient()
    if (admin) {
      const { error } = await admin.from('plans').select('id', { count: 'exact', head: true })
      db = error ? 'down' : 'ok'
    }
  } catch {
    db = 'down'
  }

  const ok = db !== 'down'
  return NextResponse.json(
    { ok, db, latency_ms: Date.now() - started, ts: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  )
}
