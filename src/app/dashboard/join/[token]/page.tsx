'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Loader2, Home, AlertCircle, CheckCircle, Users, Calendar,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface InvitePreview {
  household_name: string
  member_count: number
  max_seats: number
  expires_at: string
  invited_by_name: string | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'preview'; data: InvitePreview }
  | { kind: 'accepting' }
  | { kind: 'accepted' }
  | { kind: 'error'; message: string }

export default function JoinHouseholdPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token])

  async function load() {
    const token = params.token
    if (!token) { setState({ kind: 'invalid', reason: 'Token undangan tidak ada di URL.' }); return }

    // Look up the invitation via a SECURITY DEFINER RPC that returns ONLY the
    // single row matching this exact token (safe display fields, never the
    // token or a list) — keeps invite tokens un-enumerable. See migrations
    // 027/028. The RPC also resolves member_count + inviter name server-side,
    // which the old client query couldn't read under RLS.
    const { data, error } = await supabase
      .rpc('get_household_invitation', { invite_token: token })
      .maybeSingle()

    if (error || !data) {
      setState({ kind: 'invalid', reason: 'Undangan tidak ditemukan. Mungkin sudah kedaluwarsa atau dibatalkan.' })
      return
    }

    type InvRow = {
      status: string
      expires_at: string
      household_id: string
      household_name: string | null
      max_seats: number | null
      invited_by_name: string | null
      member_count: number | null
    }
    const inv = data as InvRow

    if (inv.status !== 'pending') {
      setState({ kind: 'invalid', reason: `Undangan ini sudah ${inv.status === 'accepted' ? 'diterima' : inv.status === 'revoked' ? 'dibatalkan' : 'kedaluwarsa'}.` })
      return
    }

    if (new Date(inv.expires_at) < new Date()) {
      setState({ kind: 'invalid', reason: 'Undangan sudah kedaluwarsa (lewat 7 hari).' })
      return
    }

    setState({
      kind: 'preview',
      data: {
        household_name: inv.household_name ?? 'Keluarga',
        member_count: inv.member_count ?? 0,
        max_seats: inv.max_seats ?? 4,
        expires_at: inv.expires_at,
        invited_by_name: inv.invited_by_name ?? null,
      },
    })
  }

  async function accept() {
    setState({ kind: 'accepting' })
    const { data, error } = await supabase.rpc('accept_household_invitation', {
      invite_token: params.token,
    })

    if (error) {
      setState({ kind: 'error', message: error.message })
      return
    }

    const result = data as { success: boolean; error?: string; household_id?: string }
    if (!result.success) {
      setState({ kind: 'error', message: result.error ?? 'Gagal terima undangan.' })
      return
    }

    setState({ kind: 'accepted' })
    setTimeout(() => router.push('/dashboard/family'), 1500)
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="rounded-2xl border bg-[var(--surface)] p-8 text-center shadow-sm">
        {state.kind === 'loading' && (
          <div className="py-12">
            <Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-muted-foreground mt-3 text-sm">Memuat undangan...</p>
          </div>
        )}

        {state.kind === 'invalid' && (
          <div>
            <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--c-coral-soft)' }}>
              <AlertCircle className="size-7" style={{ color: 'var(--c-coral)' }} />
            </div>
            <h2 className="text-xl font-bold">Undangan Tidak Valid</h2>
            <p className="text-muted-foreground mt-2 text-sm">{state.reason}</p>
            <Link href="/dashboard" className="mt-5 inline-block">
              <Button variant="outline">Kembali ke Dashboard</Button>
            </Link>
          </div>
        )}

        {state.kind === 'preview' && (
          <div>
            <div
              className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: 'linear-gradient(135deg, #10B981, #047857)',
                boxShadow: '0 10px 28px -10px rgba(16, 185, 129, 0.50)',
              }}
            >
              <Home className="size-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Undangan Keluarga</h2>
            <p className="text-muted-foreground mt-2">
              Kamu diundang bergabung dengan
            </p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--c-mint)' }}>
              {state.data.household_name}
            </p>

            <div className="mt-5 space-y-2 text-sm">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Users className="size-4" />
                {state.data.member_count} dari {state.data.max_seats} anggota
              </div>
              {state.data.invited_by_name && (
                <p className="text-muted-foreground">
                  Diundang oleh <strong className="text-foreground">{state.data.invited_by_name}</strong>
                </p>
              )}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3" />
                Berlaku sampai {formatDate(new Date(state.data.expires_at))}
              </div>
            </div>

            <div
              className="mt-5 rounded-lg border p-3 text-left text-xs"
              style={{
                background: 'var(--sky-50)',
                borderColor: 'color-mix(in srgb, var(--sky-500) 25%, transparent)',
                color: 'var(--sky-600)',
              }}
            >
              Setelah gabung, kamu akan punya akses bersama ke <strong>akun, transaksi, dan budget</strong> keluarga.
              Data personalmu yang sudah ada tetap aman dan tidak ter-share.
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <Button onClick={accept} className="flex-1">
                <CheckCircle className="size-4" data-icon="inline-start" />
                Terima Undangan
              </Button>
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">Tolak</Button>
              </Link>
            </div>
          </div>
        )}

        {state.kind === 'accepting' && (
          <div className="py-12">
            <Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-muted-foreground mt-3 text-sm">Memproses...</p>
          </div>
        )}

        {state.kind === 'accepted' && (
          <div>
            <div className="mx-auto h-14 w-14 rounded-full bg-[var(--c-mint-soft)] flex items-center justify-center mb-3">
              <CheckCircle className="size-7 text-[var(--c-mint)]" />
            </div>
            <h2 className="text-xl font-bold">Selamat bergabung!</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Kamu sekarang anggota keluarga. Mengarahkan ke halaman keluarga...
            </p>
          </div>
        )}

        {state.kind === 'error' && (
          <div>
            <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--c-coral-soft)' }}>
              <AlertCircle className="size-7" style={{ color: 'var(--c-coral)' }} />
            </div>
            <h2 className="text-xl font-bold">Gagal Terima Undangan</h2>
            <p className="text-muted-foreground mt-2 text-sm">{state.message}</p>
            <div className="mt-5 flex gap-2 justify-center">
              <Button variant="outline" onClick={load}>Coba Lagi</Button>
              <Link href="/dashboard"><Button variant="outline">Dashboard</Button></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
