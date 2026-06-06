'use client'

/**
 * Login — clean centered card on the shared (auth)/layout shell.
 * Brand promise (serif moment) + honest security line, not a bare form.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(humanError(error.message)); return }
      router.push('/dashboard')
    } catch {
      setError('Ada masalah. Coba lagi sebentar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="font-bold tracking-tight" style={{ fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.025em' }}>
          Selamat datang <span style={SERIF}>lagi.</span>
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>Uangmu udah nungguin, udah dirapihin.</p>
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
            Biarin aku tetap masuk
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
