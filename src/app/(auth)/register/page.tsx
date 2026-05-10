'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/context'
import { LanguageToggle } from '@/components/layout/language-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Mail, Lock, Sparkles } from 'lucide-react'

export default function RegisterPage() {
  const t = useT()
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
      if (error) { setError(error.message); return }
      setSuccess(true)
    } catch {
      setError(t('auth.error_generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — matches login page emerald palette */}
      <div
        className="relative flex w-full flex-col items-center justify-center overflow-hidden px-8 py-16 lg:w-[55%] lg:py-0"
        style={{
          background:
            'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #0F1F1A 100%)',
        }}
      >
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

        <div className="relative z-10 max-w-md text-center text-white">
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
            Mulai perjalanan{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, #34D399 0%, #6EE7B7 50%, #A5F3FC 100%)',
              }}
            >
              finansialmu
            </span>
          </h1>
          <p
            className="mt-5 text-sm lg:text-base leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.70)' }}
          >
            Daftar gratis. Mulai catat transaksi, monitor investasi & utang,
            dan capai tujuan finansial dengan dibantu AI.
          </p>
          <div className="mt-8 flex justify-center gap-2 flex-wrap">
            {[
              { label: 'AI Receipt Scanner', tint: 'rgba(16,185,129,0.18)', fg: '#6EE7B7' },
              { label: 'Live Stock Quote', tint: 'rgba(14,165,233,0.18)', fg: '#7DD3FC' },
              { label: 'Smart Insights', tint: 'rgba(245,158,11,0.18)', fg: '#FCD34D' },
            ].map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium border"
                style={{
                  background: chip.tint,
                  color: chip.fg,
                  borderColor: 'rgba(255,255,255,0.10)',
                }}
              >
                <Sparkles className="size-3" />
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        className="flex w-full items-center justify-center px-6 py-12 lg:w-[45%] lg:px-12"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <p className="caps">{t('auth.register_page')}</p>
              <h2 className="text-2xl font-semibold mt-1" style={{ color: 'var(--ink)' }}>
                {t('auth.create_account')}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
                {t('auth.register_description')}
              </p>
            </div>
            <LanguageToggle />
          </div>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            {error && (
              <div
                className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                style={{
                  backgroundColor: 'var(--danger-bg)',
                  borderColor: '#FECDD3',
                  color: 'var(--danger)',
                }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                style={{
                  backgroundColor: 'var(--success-bg)',
                  borderColor: '#A7F3D0',
                  color: 'var(--emerald-700)',
                }}
              >
                {t('auth.success_register')}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">{t('auth.full_name')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Nama Lengkap"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
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
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || success}
              className="mt-2 h-11 w-full text-sm font-medium"
              style={{
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#FFFFFF',
              }}
            >
              {loading ? t('auth.processing') : t('auth.register_button')}
            </Button>

            <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
              {t('auth.have_account')}{' '}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--emerald-600, #059669)' }}>
                {t('auth.login_link')}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
