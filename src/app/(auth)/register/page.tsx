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
      style={{ background: 'var(--paper)' }}
    >
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-extrabold text-white"
              style={{
                background: 'linear-gradient(135deg, var(--emerald-500), var(--emerald-700))',
                letterSpacing: '-0.04em',
                boxShadow: '0 10px 28px -10px rgba(16,185,129,0.50)',
              }}
            >
              K
            </div>
          </Link>
          <h1
            className="mt-4 text-2xl font-bold tracking-tight"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
          >
            Klunting.
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Coba 14 hari gratis. Tanpa kartu kredit.
          </p>
        </div>

        {/* Form */}
        <div
          className="mt-8 rounded-2xl border p-6"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border-soft)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
            {error && (
              <div
                className="rounded-lg border p-3 text-sm"
                style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  borderColor: 'rgba(239, 68, 68, 0.30)',
                  color: '#991B1B',
                }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                className="rounded-lg border p-3 text-sm"
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderColor: 'rgba(16, 185, 129, 0.30)',
                  color: 'var(--emerald-800)',
                }}
              >
                Cek email kamu, udah aku kirim link konfirmasi.
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
              disabled={loading || success}
              className="mt-2 h-11 w-full text-sm font-semibold"
              style={{
                background: 'linear-gradient(135deg, var(--emerald-500), var(--emerald-700))',
                color: '#FFFFFF',
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
        </div>

        {/* Login link */}
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
      </div>
    </div>
  )
}
