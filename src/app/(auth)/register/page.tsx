'use client'

/**
 * Register page — same minimalist treatment as login.
 * Logo → nama → tagline → form (nama + email + password) → link masuk.
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
      <div className="w-full" style={{ maxWidth: 420 }}>
        {/* Brand */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <div className="kl-brandmark mx-auto" style={{ width: 56, height: 56, borderRadius: 16 }}>
              <span>K</span>
            </div>
          </Link>
          <h1
            className="mt-4 kl-display"
            style={{
              fontSize: 32,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            Klunting<em style={{ color: 'var(--c-mint)', fontStyle: 'normal' }}>.</em>
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-mute)' }}>
            Coba 14 hari gratis. Tanpa kartu kredit.
          </p>
        </div>

        {/* Form / Success */}
        <div className="kl-card mt-8 p-6 sm:p-7">
          {success ? (
            <div className="text-center py-2">
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'var(--success-bg)',
                  color: 'var(--success)',
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
                Link konfirmasi udah dikirim ke <strong style={{ color: 'var(--ink)' }}>{email}</strong>.
                Klik link itu buat aktifkan akun & masuk ke dashboard.
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
                    background: 'var(--danger-bg)',
                    borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
                    color: 'var(--danger)',
                  }}
                >
                  {error}
                </div>
              )}

              <Input
                type="text"
                placeholder="Nama lengkap"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11"
                autoComplete="name"
              />

              <Input
                type="email"
                placeholder="Alamat email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
                autoComplete="email"
              />

              <Input
                type="password"
                placeholder="Password (minimal 6 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
                autoComplete="new-password"
              />

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full text-sm font-semibold kl-btn-primary"
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

        {/* Login link — only show when not in success state */}
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
