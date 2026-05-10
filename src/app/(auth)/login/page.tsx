'use client'

/**
 * Login page — full redesign aligned with the app's emerald-forward palette.
 *
 * Left side: dark navy panel with emerald + indigo ambient glows, the brand
 * mark, a tagline, and 4 mini-feature pills that hint at what the app does.
 * Right side: clean white card with the form, no chrome competing with it.
 *
 * The previous design used a purple/violet gradient that didn't match the
 * dashboard at all — felt like a different app.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/context'
import { LanguageToggle } from '@/components/layout/language-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Mail, Lock, Wallet, TrendingUp, Receipt, Target, Sparkles,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const t = useT()
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
      setError(t('auth.error_generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ─── LEFT — Brand panel ─────────────────────────────── */}
      <div
        className="relative flex w-full flex-col items-center justify-center overflow-hidden px-8 py-16 lg:w-[55%] lg:py-0"
        style={{
          background:
            'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #0F1F1A 100%)',
        }}
      >
        {/* Ambient color glows — matches the dashboard background pattern */}
        <div
          className="absolute left-[10%] top-[18%] h-72 w-72 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(16, 185, 129, 0.22)' }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-[12%] right-[8%] h-80 w-80 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(99, 102, 241, 0.18)' }}
          aria-hidden="true"
        />
        <div
          className="absolute left-[55%] top-[60%] h-40 w-40 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.10)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-md text-center text-white">
          {/* Brand mark — emerald monogram matching app icon */}
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-bold shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #10B981, #059669)',
              color: '#FFFFFF',
              letterSpacing: '-0.05em',
              boxShadow: '0 12px 32px -8px rgba(16, 185, 129, 0.45)',
            }}
          >
            P
          </div>

          <p
            className="mt-5 text-[10px] uppercase tracking-[0.24em] font-medium"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            klunting · atur duitmu sendiri
          </p>

          <h1 className="mt-3 text-4xl font-bold leading-tight lg:text-5xl tracking-tight">
            Kelola uangmu,{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, #34D399 0%, #6EE7B7 50%, #A5F3FC 100%)',
              }}
            >
              dengan AI
            </span>
          </h1>
          <p
            className="mt-5 text-sm lg:text-base leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.70)' }}
          >
            Catat transaksi natural language, scan struk pakai kamera,
            track aset & utang, lihat aliran uangmu — semuanya di satu tempat.
          </p>

          {/* Feature pills — hint at what's inside */}
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Cashflow', icon: Receipt, tint: 'rgba(16,185,129,0.18)', fg: '#6EE7B7' },
              { label: 'Investasi', icon: TrendingUp, tint: 'rgba(14,165,233,0.18)', fg: '#7DD3FC' },
              { label: 'Aset', icon: Wallet, tint: 'rgba(245,158,11,0.18)', fg: '#FCD34D' },
              { label: 'Goals', icon: Target, tint: 'rgba(99,102,241,0.18)', fg: '#A5B4FC' },
            ].map((chip) => {
              const Icon = chip.icon
              return (
                <span
                  key={chip.label}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium border"
                  style={{
                    background: chip.tint,
                    color: chip.fg,
                    borderColor: 'rgba(255,255,255,0.10)',
                  }}
                >
                  <Icon className="size-3" />
                  {chip.label}
                </span>
              )
            })}
          </div>

          {/* Subtle social proof / value prop */}
          <p
            className="mt-8 inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full"
            style={{
              color: 'rgba(255,255,255,0.55)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Sparkles className="size-3" style={{ color: '#34D399' }} />
            Powered by Claude AI · Bank-grade security
          </p>
        </div>
      </div>

      {/* ─── RIGHT — Login form ─────────────────────────────── */}
      <div
        className="flex w-full items-center justify-center px-6 py-12 lg:w-[45%] lg:px-12"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <p className="caps">{t('auth.login_page')}</p>
              <h2
                className="text-2xl font-semibold mt-1 tracking-tight"
                style={{ color: 'var(--ink)' }}
              >
                {t('auth.welcome_back')}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
                {t('auth.login_description')}
              </p>
            </div>
            <LanguageToggle />
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div
                className="flex items-start gap-2 rounded-lg border p-3 text-sm"
                style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  borderColor: 'rgba(239, 68, 68, 0.30)',
                  color: '#991B1B',
                }}
              >
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'var(--ink-soft)' }}
                />
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'var(--ink-soft)' }}
                />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full text-sm font-medium"
              style={{
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#FFFFFF',
              }}
            >
              {loading ? t('auth.processing') : t('auth.login_button')}
            </Button>

            <p
              className="text-center text-sm"
              style={{ color: 'var(--ink-muted)' }}
            >
              {t('auth.no_account')}{' '}
              <Link
                href="/register"
                className="font-semibold hover:underline"
                style={{ color: 'var(--emerald-600, #059669)' }}
              >
                {t('auth.register_link')}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
