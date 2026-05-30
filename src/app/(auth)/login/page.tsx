'use client'

/**
 * Login page — Wise/Bibit-inspired clean fintech.
 * Logo lock-up → 1-line tagline → form card → register link.
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
                background: 'var(--c-primary)',
                color: 'var(--c-primary-foreground)',
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
            Selamat datang
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Masuk ke akun Klunting kamu.
          </p>
        </div>

        {/* Form card */}
        <div className="s-card s-card-pad-lg">
          <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
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
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="text-xs font-semibold"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium hover:underline"
                  style={{ color: 'var(--c-mint)' }}
                >
                  Lupa?
                </Link>
              </div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full text-sm font-semibold"
              style={{
                background: 'var(--c-primary)',
                color: 'var(--c-primary-foreground)',
                border: 0,
              }}
            >
              {loading ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>
        </div>

        {/* Register link */}
        <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Belum punya akun?{' '}
          <Link
            href="/register"
            className="font-semibold hover:underline"
            style={{ color: 'var(--ink)' }}
          >
            Daftar gratis
          </Link>
        </p>
      </div>
    </div>
  )
}
