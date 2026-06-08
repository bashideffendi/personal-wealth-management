'use client'

/**
 * Login — clean centered card on the shared (auth)/layout shell.
 * Brand promise (serif moment) + honest security line, not a bare form.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { GoogleSignInButton } from '@/components/auth/google-signin-button'

const SERIF = { fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' } as const

// Translate the Supabase errors users actually hit — never show raw English.
function humanError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email atau password salah.'
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Cek inbox kamu dulu ya.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Kebanyakan percobaan. Tunggu sebentar, terus coba lagi.'
  return 'Ada masalah. Coba lagi sebentar.'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mfa, setMfa] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')

  // If we land here already authenticated at AAL1 with MFA enrolled (e.g. the
  // dashboard bounced us back to finish 2FA), surface the code step right away.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (!active || !aal || aal.nextLevel !== 'aal2' || aal.currentLevel !== 'aal1') return
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totp = factors?.totp?.find((f: { id: string; status: string }) => f.status === 'verified')
        if (!totp) return
        const { data: ch } = await supabase.auth.mfa.challenge({ factorId: totp.id })
        if (active && ch) { setMfaCode(''); setMfa({ factorId: totp.id, challengeId: ch.id }) }
      } catch {
        /* ignore — fall back to the normal login form */
      }
    })()
    return () => { active = false }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(humanError(error.message)); return }
      // 2FA step-up — if a verified authenticator factor exists, require the code.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal && aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totp = factors?.totp?.find((f: { id: string; status: string }) => f.status === 'verified')
        if (totp) {
          const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: totp.id })
          if (ce || !ch) { setError('Gagal mulai verifikasi 2FA. Coba lagi.'); return }
          setMfaCode('')
          setMfa({ factorId: totp.id, challengeId: ch.id })
          return
        }
      }
      router.push('/dashboard')
    } catch {
      setError('Ada masalah. Coba lagi sebentar.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault()
    if (!mfa) return
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.verify({ factorId: mfa.factorId, challengeId: mfa.challengeId, code: mfaCode.replace(/\D/g, '') })
      if (error) { setError('Kode salah atau kedaluwarsa. Coba kode terbaru.'); return }
      router.push('/dashboard')
    } catch {
      setError('Ada masalah. Coba lagi sebentar.')
    } finally {
      setLoading(false)
    }
  }

  // ── 2FA step (shown after password when an authenticator factor is enrolled) ──
  if (mfa) {
    return (
      <>
        <div className="text-center mb-8">
          <h1 className="font-bold tracking-tight" style={{ fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.025em' }}>
            Verifikasi <span style={SERIF}>2 langkah.</span>
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>Masukin kode 6 digit dari app authenticator kamu.</p>
        </div>
        <form onSubmit={verifyMfa} className="flex flex-col gap-3.5">
          {error && (
            <div className="rounded-lg border p-3 text-sm" style={{ background: 'var(--c-coral-soft)', borderColor: 'color-mix(in srgb, var(--c-coral) 30%, transparent)', color: 'var(--c-coral)' }}>
              {error}
            </div>
          )}
          <Input
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            className="h-12 text-center tracking-[0.4em] font-mono text-xl"
          />
          <Button type="submit" disabled={loading || mfaCode.length < 6} className="mt-1 h-11 w-full text-sm font-semibold" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', border: 0 }}>
            {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Memproses…</span> : 'Verifikasi'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm">
          <button type="button" onClick={async () => { try { await createClient().auth.signOut() } catch { /* ignore */ } setMfa(null); setMfaCode(''); setError(null) }} className="font-medium hover:underline" style={{ color: 'var(--ink-muted)' }}>← Keluar &amp; kembali</button>
        </p>
      </>
    )
  }

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="font-bold tracking-tight" style={{ fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.025em' }}>
          Selamat datang <span style={SERIF}>kembali.</span>
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>Masuk untuk melanjutkan.</p>
      </div>

      <GoogleSignInButton label="Lanjut dengan Google" />
      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>atau</span>
        <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
          {error && (
            <div className="rounded-lg border p-3 text-sm" style={{ background: 'var(--c-coral-soft)', borderColor: 'color-mix(in srgb, var(--c-coral) 30%, transparent)', color: 'var(--c-coral)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-muted)' }}>Email</label>
            <Input type="email" placeholder="kamu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" autoComplete="email" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--ink-muted)' }}>Password</label>
              <Link href="/forgot-password" className="text-xs font-medium hover:underline" style={{ color: 'var(--c-mint)' }}>Lupa?</Link>
            </div>
            <div className="relative">
              <Input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 pr-10" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Sembunyikan password' : 'Lihat password'} className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-7 rounded-md" style={{ color: 'var(--ink-soft)' }}>
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm select-none cursor-pointer" style={{ color: 'var(--ink-muted)' }}>
            <input type="checkbox" defaultChecked className="size-4 rounded" style={{ accentColor: 'var(--c-primary)' }} />
            Tetap masuk di perangkat ini
          </label>

          <Button type="submit" disabled={loading} className="mt-1 h-11 w-full text-sm font-semibold" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', border: 0 }}>
            {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Memproses…</span> : 'Masuk'}
          </Button>
        </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Belum punya akun Klunting?{' '}
        <Link href="/register" className="font-semibold hover:underline" style={{ color: 'var(--ink)' }}>Coba gratis →</Link>
      </p>
    </>
  )
}
