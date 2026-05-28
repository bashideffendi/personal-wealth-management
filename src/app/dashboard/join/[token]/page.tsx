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

    // Fetch invitation row + nested household name + inviter profile name
    const { data: invData, error: invErr } = await supabase
      .from('household_invitations')
      .select('id, status, expires_at, household_id, invited_by, households(name, max_seats), profiles!household_invitations_invited_by_fkey(full_name)')
      .eq('token', token)
      .maybeSingle()

    if (invErr || !invData) {
      setState({ kind: 'invalid', reason: 'Undangan tidak ditemukan. Mungkin sudah kedaluwarsa atau dibatalkan.' })
      return
    }

    type RawInv = {
      id: string
      status: string
      expires_at: string
      household_id: string
      invited_by: string
      households: { name: string; max_seats: number } | null
      profiles: { full_name: string | null } | null
    }
    const inv = invData as RawInv

    if (inv.status !== 'pending') {
      setState({ kind: 'invalid', reason: `Undangan ini sudah ${inv.status === 'accepted' ? 'diterima' : inv.status === 'revoked' ? 'dibatalkan' : 'kedaluwarsa'}.` })
      return
    }

    if (new Date(inv.expires_at) < new Date()) {
      setState({ kind: 'invalid', reason: 'Undangan sudah kedaluwarsa (lewat 7 hari).' })
      return
    }

    // Member count
    const { count } = await supabase
      .from('household_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('household_id', inv.household_id)

    setState({
      kind: 'preview',
      data: {
        household_name: inv.households?.name ?? 'Keluarga',
        member_count: count ?? 0,
        max_seats: inv.households?.max_seats ?? 4,
        expires_at: inv.expires_at,
        invited_by_name: inv.profiles?.full_name ?? null,
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
      <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
        {state.kind === 'loading' && (
          <div className="py-12">
            <Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-muted-foreground mt-3 text-sm">Memuat undangan...</p>
          </div>
        )}

        {state.kind === 'invalid' && (
          <div>
            <div className="mx-auto h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <AlertCircle className="size-7 text-red-600" />
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

            <div className="mt-5 rounded-lg bg-blue-50 border border-blue-200 p-3 text-left text-xs text-blue-900">
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
            <h2 className="text-xl font-bold">🎉 Selamat Bergabung!</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Kamu sekarang anggota keluarga. Mengarahkan ke halaman keluarga...
            </p>
          </div>
        )}

        {state.kind === 'error' && (
          <div>
            <div className="mx-auto h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <AlertCircle className="size-7 text-red-600" />
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
