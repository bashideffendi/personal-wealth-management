import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendHouseholdInviteEmail } from '@/lib/email'

export const runtime = 'nodejs'

/**
 * Kirim email undangan keluarga untuk satu invitation yang sudah dibuat.
 *
 * Safety: client SSR user-scoped (RLS), TANPA service-role. Hanya owner
 * household-nya yang lolos (dicek eksplisit di bawah, selain RLS).
 * Tanpa RESEND_API_KEY, send() no-op aman → { sent: false, skipped: true }.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { invitationId?: string } | null
  if (!body?.invitationId) {
    return NextResponse.json({ error: 'invitationId wajib diisi' }, { status: 400 })
  }

  const { data } = await supabase
    .from('household_invitations')
    .select('id, email, token, status, household_id, households!inner(name, owner_user_id)')
    .eq('id', body.invitationId)
    .maybeSingle()
  type Row = {
    id: string; email: string | null; token: string; status: string; household_id: string
    households: { name: string; owner_user_id: string } | null
  }
  const inv = data as Row | null
  if (!inv || inv.status !== 'pending') {
    return NextResponse.json({ error: 'Undangan tidak ditemukan' }, { status: 404 })
  }
  if (inv.households?.owner_user_id !== user.id) {
    return NextResponse.json({ error: 'Hanya pemilik keluarga yang bisa kirim undangan' }, { status: 403 })
  }
  if (!inv.email) return NextResponse.json({ sent: false, reason: 'no_email' })

  const { data: prof } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klunting.com'
  const result = await sendHouseholdInviteEmail(inv.email, {
    inviterName: (prof as { full_name?: string | null } | null)?.full_name?.trim() || undefined,
    householdName: inv.households?.name,
    inviteUrl: `${origin}/dashboard/join/${inv.token}`,
  })
  const skipped = !result.ok && 'skipped' in result && result.skipped === true
  return NextResponse.json({ sent: result.ok, skipped })
}
