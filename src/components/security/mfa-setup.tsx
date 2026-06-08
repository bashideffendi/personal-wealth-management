'use client'

/**
 * Two-factor auth (TOTP) setup — Supabase MFA.
 * Enroll → scan QR in an authenticator app → verify a 6-digit code → active.
 * Once a verified factor exists, login requires the code (see login step-up).
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShieldCheck, Loader2, Trash2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n/context'

type Status = 'loading' | 'idle' | 'enrolling' | 'enrolled'

export function MfaSetup() {
  const t = useT()
  const supabase = createClient()
  const [status, setStatus] = useState<Status>('loading')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { void refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) { setStatus('idle'); return }
    const verified = data?.totp?.find((f: { id: string; status: string }) => f.status === 'verified')
    if (verified) { setFactorId(verified.id); setStatus('enrolled') }
    else setStatus('idle')
  }

  async function startEnroll() {
    setBusy(true)
    try {
      // Clear any leftover unverified factor from a prior abandoned attempt.
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of list?.totp ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (error || !data) { toast.error(t('mfa.enroll_failed')); return }
      setFactorId(data.id)
      setQr(data.totp.qr_code)
      setSecret(data.totp.secret)
      setCode('')
      setStatus('enrolling')
    } catch {
      toast.error(t('mfa.enroll_failed'))
    } finally { setBusy(false) }
  }

  async function verifyEnroll() {
    if (!factorId || code.replace(/\D/g, '').length < 6) return
    setBusy(true)
    try {
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId })
      if (ce || !ch) { toast.error(t('mfa.verify_failed')); return }
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.replace(/\D/g, '') })
      if (error) { toast.error(t('mfa.code_wrong')); return }
      toast.success(t('mfa.enabled'))
      setQr(null); setSecret(null); setCode('')
      setStatus('enrolled')
    } catch {
      toast.error(t('mfa.verify_failed'))
    } finally { setBusy(false) }
  }

  async function disable() {
    if (!factorId) return
    if (!confirm(t('mfa.disable_confirm'))) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) { toast.error(t('mfa.disable_failed')); return }
      toast.success(t('mfa.disabled'))
      setFactorId(null); setStatus('idle')
    } catch {
      toast.error(t('mfa.disable_failed'))
    } finally { setBusy(false) }
  }

  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="size-4 mt-0.5" style={{ color: status === 'enrolled' ? 'var(--c-mint)' : 'var(--ink-soft)' }} />
          <div>
            <h3 className="font-semibold">{t('mfa.title')}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{t('mfa.desc')}</p>
          </div>
        </div>
        {status === 'enrolled' && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint)' }}>
            <ShieldCheck className="size-3.5" /> {t('mfa.active')}
          </span>
        )}
      </div>

      {status === 'loading' && <div className="py-2"><Loader2 className="size-4 animate-spin" style={{ color: 'var(--ink-soft)' }} /></div>}

      {status === 'idle' && (
        <Button onClick={startEnroll} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" data-icon="inline-start" /> : <Smartphone className="size-4" data-icon="inline-start" />}
          {t('mfa.enable')}
        </Button>
      )}

      {status === 'enrolled' && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('mfa.active_desc')}</p>
          <Button variant="outline" onClick={disable} disabled={busy} style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}>
            {busy ? <Loader2 className="size-4 animate-spin" data-icon="inline-start" /> : <Trash2 className="size-4" data-icon="inline-start" />}
            {t('mfa.disable')}
          </Button>
        </div>
      )}

      {status === 'enrolling' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('mfa.scan_title')}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>{t('mfa.scan_desc')}</p>
          </div>
          {qr && (
            <div className="inline-block rounded-xl bg-white p-3 border" style={{ borderColor: 'var(--border-soft)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR 2FA" width={160} height={160} />
            </div>
          )}
          {secret && (
            <div className="rounded-lg px-3 py-2 text-xs font-mono break-all" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
              {secret}
            </div>
          )}
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-muted)' }}>{t('mfa.code_label')}</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="h-11 w-40 text-center tracking-[0.3em] font-mono text-lg"
              onKeyDown={(e) => { if (e.key === 'Enter') verifyEnroll() }}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={verifyEnroll} disabled={busy || code.length < 6}>
              {busy && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
              {t('mfa.verify')}
            </Button>
            <Button variant="outline" onClick={() => { setStatus('idle'); setQr(null); setSecret(null) }} disabled={busy}>
              {t('mfa.cancel')}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
