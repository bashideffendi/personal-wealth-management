'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/dashboard`
          : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        setError(error.message)
        return
      }
      setSent(true)
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
            Reset password
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Masukin email, link reset bakal dikirim ke inbox.
          </p>
        </div>

        {/* Form card */}
        <div className="s-card s-card-pad-lg">
          {sent ? (
            <div className="text-center py-2">
              <div
                className="mx-auto grid place-items-center mb-4"
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
              <p className="text-sm" style={{ color: 'var(--ink)' }}>
                Link reset terkirim ke <strong>{email}</strong>.
              </p>
              <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                Cek inbox (dan folder spam). Belum dapet dalam 5 menit?
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-3 text-sm font-semibold hover:underline"
                style={{ color: 'var(--c-mint)' }}
              >
                Kirim ulang
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
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
                {loading ? 'Memproses…' : 'Kirim link reset'}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Inget password kamu?{' '}
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
