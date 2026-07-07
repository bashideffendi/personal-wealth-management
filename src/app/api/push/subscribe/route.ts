import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Simpan / hapus Web Push subscription milik user login.
 *
 * Safety: client SSR user-scoped (RLS own-only, migrasi 063) — user cuma bisa
 * nulis/hapus baris miliknya sendiri. Endpoint unik global: upsert onConflict
 * endpoint biar re-subscribe device yang sama gak numpuk baris.
 *
 * Graceful pre-migrasi: kalau tabel belum ada (42P01) balas 503 singkat —
 * UI tinggal toast gagal biasa, fitur lain gak kena.
 */

const MIGRATION_HINT = 'Fitur notifikasi belum siap (migrasi 063 belum dijalankan).'

function isMissingTable(code: string | undefined): boolean {
  return code === '42P01' || code === '42703' || code === 'PGRST205'
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as {
    endpoint?: string
    p256dh?: string
    auth?: string
  } | null
  if (!body?.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: 'endpoint, p256dh, dan auth wajib diisi' }, { status: 400 })
  }
  if (typeof body.endpoint !== 'string' || !body.endpoint.startsWith('https://')) {
    return NextResponse.json({ error: 'endpoint tidak valid' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth },
      { onConflict: 'endpoint' },
    )

  if (error) {
    if (isMissingTable(error.code)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
    }
    return NextResponse.json({ error: 'Gagal menyimpan subscription' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null
  if (!body?.endpoint) {
    return NextResponse.json({ error: 'endpoint wajib diisi' }, { status: 400 })
  }

  // RLS jamin cuma baris milik user ini yang kehapus.
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)

  if (error) {
    if (isMissingTable(error.code)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
    }
    return NextResponse.json({ error: 'Gagal menghapus subscription' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
