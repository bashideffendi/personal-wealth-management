'use client'

/**
 * Register — mirrors login on the shared (auth)/layout shell.
 * Warm headline + friction-killers, password toggle, honest success view.
 */

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Check, Loader2 } from 'lucide-react'
import { GoogleSignInButton } from '@/components/auth/google-signin-button'

function humanError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) return 'Email ini udah terdaftar. Coba masuk?'
  if (m.includes('password') && m.includes('weak')) return 'Password terlalu lemah — coba yang lebih panjang.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Kebanyakan percobaan. Tunggu sebentar, terus coba lagi.'
  if (m.includes('invalid') && m.includes('email')) return 'Format email-nya kurang pas. Cek lagi ya.'
  return 'Ada masalah. Coba lagi sebentar.'
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) { setError('Centang persetujuan Syarat & Kebijakan Privasi dulu ya.'); return }
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) { setError(humanError(error.message)); return }
      setSuccess(true)
    } catch {
      setError('Ada masalah. Coba lagi sebentar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!success && (
        <div className="text-center mb-8">
          <h1 className="font-bold tracking-tight" style={{ fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.025em' }}>
            Buat akun Klunting.
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>Coba 21 hari gratis, tanpa kartu kredit.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px]" style={{ color: 'var(--ink-soft)' }}>
            {['Akses penuh', 'Tanpa kartu kredit', 'Batal kapan saja'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><Check className="size-3.5" style={{ color: 'var(--c-mint-ink)' }} /> {t}</span>
            ))}
          </div>
        </div>
      )}

      {success ? (
          <div className="text-center py-2">
            <div className="mx-auto grid place-items-center" style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}>
              <svg className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-bold" style={{ color: 'var(--ink)' }}>Cek email kamu</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
              Tautan konfirmasi sudah dikirim ke <strong style={{ color: 'var(--ink)' }}>{email}</strong>. Klik untuk mengaktifkan akun.
            </p>
            <p className="mt-4 text-xs" style={{ color: 'var(--ink-soft)' }}>Belum diterima dalam 5 menit? Cek folder spam.</p>
            <button
              type="button"
              onClick={() => { setSuccess(false); setEmail(''); setPassword(''); setFullName('') }}
              className="mt-4 text-sm font-semibold hover:underline"
              style={{ color: 'var(--c-mint-ink)' }}
            >
              Gunakan email lain
            </button>
          </div>
        ) : (
          <>
          <GoogleSignInButton label="Daftar dengan Google" />
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>atau</span>
            <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
          </div>
          <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
            {error && (
              <div className="rounded-lg border p-3 text-sm" style={{ background: 'var(--c-coral-soft)', borderColor: 'color-mix(in srgb, var(--c-coral) 30%, transparent)', color: 'var(--c-coral-ink)' }}>
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-muted)' }}>Nama lengkap</label>
              <Input type="text" placeholder="Budi Santoso" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-11" autoComplete="name" />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-muted)' }}>Email</label>
              <Input type="email" placeholder="kamu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" autoComplete="email" />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-muted)' }}>Password</label>
              <div className="relative">
                <Input type={showPw ? 'text' : 'password'} placeholder="Minimal 8 karakter" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="h-11 pr-10" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Sembunyikan password' : 'Lihat password'} className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-7 rounded-md" style={{ color: 'var(--ink-soft)' }}>
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>Minimal 8 karakter, kombinasi huruf dan angka.</p>
            </div>

            <label className="flex items-start gap-2 text-[11px] leading-relaxed mt-1 cursor-pointer" style={{ color: 'var(--ink-soft)' }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer"
                style={{ accentColor: 'var(--c-primary)' }}
              />
              <span>
                Aku setuju dengan{' '}
                <Link href="/terms" className="underline" style={{ color: 'var(--ink-muted)' }}>Syarat &amp; Ketentuan</Link> dan{' '}
                <Link href="/privacy" className="underline" style={{ color: 'var(--ink-muted)' }}>Kebijakan Privasi</Link>, termasuk pemrosesan data finansialku sesuai UU PDP.
              </span>
            </label>

            <Button type="submit" disabled={loading || !agreed} className="mt-2 h-11 w-full text-sm font-semibold" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', border: 0 }}>
              {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Memproses…</span> : 'Coba gratis 21 hari'}
            </Button>
          </form>
          </>
        )}

      {!success && (
        <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--ink)' }}>Masuk</Link>
        </p>
      )}
    </>
  )
}
