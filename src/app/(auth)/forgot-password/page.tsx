'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

function humanError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('rate limit') || m.includes('too many') || m.includes('after')) return 'Kebanyakan percobaan. Tunggu sebentar, terus coba lagi.'
  if (m.includes('invalid') && m.includes('email')) return 'Format email-nya kurang pas. Cek lagi ya.'
  return 'Ada masalah. Coba lagi sebentar.'
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // Cooldown ticker — blocks resend spam (Supabase rate-limits otherwise).
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendReset(): Promise<boolean> {
    setError(null)
    const supabase = createClient()
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/dashboard` : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) { setError(humanError(error.message)); return false }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (await sendReset()) { setSent(true); setCooldown(45) }
    } catch {
      setError('Ada masalah. Coba lagi sebentar.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return
    setResending(true)
    try {
      // Actually re-send the email (the old version only flipped state back).
      if (await sendReset()) setCooldown(45)
    } catch {
      setError('Ada masalah. Coba lagi sebentar.')
    } finally {
      setResending(false)
    }
  }

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="font-bold tracking-tight" style={{ fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.025em' }}>Atur ulang password</h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>Masukkan email kamu. Kami kirim tautan untuk atur ulang.</p>
      </div>

      {sent ? (
          <div className="text-center py-2">
            <div className="mx-auto grid place-items-center mb-4" style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}>
              <svg className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--ink)' }}>
              Tautan terkirim ke <strong>{email}</strong>.
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
              Cek inbox dan folder spam. Belum diterima dalam 5 menit? Kirim ulang di bawah.
            </p>
            {error && <p className="mt-2 text-sm" style={{ color: 'var(--c-coral-ink)' }}>{error}</p>}
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline disabled:opacity-60 disabled:no-underline"
              style={{ color: 'var(--c-mint-ink)' }}
            >
              {resending && <Loader2 className="size-3.5 animate-spin" />}
              {cooldown > 0 ? `Kirim ulang dalam ${cooldown}s` : 'Kirim ulang'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {error && (
              <div className="rounded-lg border p-3 text-sm" style={{ background: 'var(--c-coral-soft)', borderColor: 'color-mix(in srgb, var(--c-coral) 30%, transparent)', color: 'var(--c-coral-ink)' }}>
                {error}
              </div>
            )}
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-muted)' }}>Email</label>
              <Input type="email" aria-label="Email" placeholder="kamu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" autoComplete="email" />
            </div>
            <Button type="submit" disabled={loading} className="mt-2 h-11 w-full text-sm font-semibold" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', border: 0 }}>
              {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Memproses…</span> : 'Kirim tautan'}
            </Button>
          </form>
        )}

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Ingat password kamu?{' '}
        <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--ink)' }}>Masuk</Link>
      </p>
    </>
  )
}
