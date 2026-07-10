'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

/**
 * Sesi user di CLIENT tanpa round-trip network.
 *
 * `supabase.auth.getUser()` di browser SELALU memanggil /auth/v1/user
 * (±100-300ms) — dan repo ini memanggilnya 123x di 67 file, sering beberapa
 * kali per mount di halaman yang sama. Padahal token sudah diverifikasi
 * server-side (middleware + dashboard layout) sebelum halaman client render;
 * client cukup MEMBACA sesi lokal (`getSession`) + dengar perubahan.
 *
 * Pemakaian di komponen: `const { user, userId } = useSessionUser()`.
 * Untuk queryFn/handler non-hook pakai `getSessionUser(supabase)`.
 *
 * `getUser()` (verifikasi beneran) disisakan untuk SERVER (API routes, layout).
 */
export function useSessionUser() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    void supabase.auth.getSession().then(({ data }: { data: { session: { user: User } | null } }) => {
      if (cancelled) return
      setUser(data.session?.user ?? null)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: User } | null) => {
        if (!cancelled) setUser(session?.user ?? null)
      },
    )
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, userId: user?.id ?? null, ready }
}

/** Versi non-hook untuk queryFn/handler: baca sesi lokal, TANPA network. */
export async function getSessionUser(
  supabase: ReturnType<typeof createClient>,
): Promise<User | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}
