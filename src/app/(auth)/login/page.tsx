'use client'

/**
 * Login page — Budggt-inspired: minimal, centered, single column.
 *
 * Direction: form yang fokus ke fungsi (masuk), bukan landing page kedua.
 * Logo → nama → tagline 1 baris → card form → link daftar. Done.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      router.push('/dashboard')
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
        {/* Brand — editorial "k" + mint dot per design handoff */}
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
            Atur uang & aset di satu tempat.
          </p>
        </div>

        {/* Form */}
        <div
          className="kl-card mt-8 p-6 sm:p-7"
        >
          <p className="kl-eyebrow mb-4">Masuk</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
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
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11"
              autoComplete="current-password"
            />

            <div className="flex items-center justify-end text-sm pt-1">
              <Link
                href="/forgot-password"
                className="font-medium hover:underline"
                style={{ color: 'var(--c-primary)' }}
              >
                Lupa password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full text-sm font-semibold kl-btn-primary"
            >
              {loading ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>
        </div>

        {/* Register */}
        <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Belum punya akun?{' '}
          <Link
            href="/register"
            className="font-semibold hover:underline"
            style={{ color: 'var(--ink)' }}
          >
            Daftar
          </Link>
        </p>
      </div>
    </div>
  )
}
