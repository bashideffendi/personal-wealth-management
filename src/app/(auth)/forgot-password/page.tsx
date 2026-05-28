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
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div className="text-center">
          <Link href="/" className="inline-block">
            <div className="kl-brandmark mx-auto" style={{ width: 56, height: 56, borderRadius: 16 }}>
              <span>K</span>
            </div>
          </Link>
          <h1
            className="mt-4 kl-display"
            style={{
              fontSize: 28,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              /* italic dropped per fintech revert */
            }}
          >
            Reset password
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-mute)' }}>
            Masukin email kamu, link reset bakal dikirim ke inbox.
          </p>
        </div>

        <div
          className="mt-8 rounded-2xl border p-6"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border-soft)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          {sent ? (
            <div className="text-center py-2">
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
                style={{ color: 'var(--c-primary)' }}
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

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full text-sm font-semibold"
                style={{
                  background: 'var(--c-ink)',
                  color: 'var(--bg)',
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
