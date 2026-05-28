'use client'

/**
 * Register page — Wise/Bibit-inspired clean fintech.
 */

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
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
      if (error) {
        setError(error.message)
        return
      }
      setSuccess(true)
    } catch {
      setError('Ada masalah. Coba lagi sebentar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full" style={{ maxWidth: 400 }}>
        {/* Brand lock-up */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" aria-label="Klunting">
            <div
              className="grid place-items-center mb-4"
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #10B981, #047857)',
                color: '#FFFFFF',
                boxShadow: '0 8px 24px -8px rgba(16, 185, 129, 0.45)',
                fontWeight: 800,
                fontSize: 28,
                fontFamily: 'var(--font-sans)',
                letterSpacing: '-0.04em',
              }}
            >
              K
            </div>
          </Link>
          <h1
            className="font-bold tracking-tight"
            style={{
              fontSize: 28,
              color: 'var(--ink)',
              letterSpacing: '-0.025em',
            }}
          >
            Bikin akun
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Coba 14 hari gratis. Tanpa kartu kredit.
          </p>
        </div>

        {/* Form / Success card */}
        <div className="s-card s-card-pad-lg">
          {success ? (
            <div className="text-center py-2">
              <div
                className="mx-auto grid place-items-center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--c-mint-soft)',
                  color: 'var(--c-mint)',
                }}
              >
                <svg className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-bold" style={{ color: 'var(--ink)' }}>
                Cek inbox kamu
              </h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                Link konfirmasi udah dikirim ke{' '}
                <strong style={{ color: 'var(--ink)' }}>{email}</strong>. Klik link itu buat aktifkan akun.
              </p>
              <p className="mt-4 text-xs" style={{ color: 'var(--ink-soft)' }}>
                Belum dapet dalam 5 menit? Cek folder spam.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSuccess(false)
                  setEmail('')
                  setPassword('')
                  setFullName('')
                }}
                className="mt-4 text-sm font-semibold hover:underline"
                style={{ color: 'var(--c-mint)' }}
              >
                Daftar email lain
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
              {error && (
                <div
                  className="rounded-lg border p-3 text-sm"
                  style={{
                    background: 'var(--c-coral-soft)',
                    borderColor: 'color-mix(in srgb, var(--c-coral) 30%, transparent)',
                    color: 'var(--c-coral)',
                  }}
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  className="text-xs font-semibold block mb-1.5"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  Nama lengkap
                </label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-11"
                  autoComplete="name"
                />
              </div>

              <div>
                <label
                  className="text-xs font-semibold block mb-1.5"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="kamu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                  autoComplete="email"
                />
              </div>

              <div>
                <label
                  className="text-xs font-semibold block mb-1.5"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11"
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full text-sm font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #10B981, #047857)',
                  color: '#FFFFFF',
                  border: 0,
                  boxShadow: '0 4px 12px -4px rgba(16, 185, 129, 0.40)',
                }}
              >
                {loading ? 'Memproses…' : 'Daftar'}
              </Button>

              <p
                className="text-center text-[11px] leading-relaxed mt-1"
                style={{ color: 'var(--ink-soft)' }}
              >
                Dengan daftar, kamu setuju dengan{' '}
                <Link href="/terms" className="underline">Syarat & Ketentuan</Link>
                {' '}dan{' '}
                <Link href="/privacy" className="underline">Kebijakan Privasi</Link>.
              </p>
            </form>
          )}
        </div>

        {!success && (
          <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
            Udah punya akun?{' '}
            <Link
              href="/login"
              className="font-semibold hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              Masuk
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
