'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Wallet,
  PiggyBank,
  CreditCard,
  TrendingUp,
  Target,
  LineChart,
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/context'
import { ACCOUNT_TYPES } from '@/lib/constants'
import {
  loadTree,
  saveTree,
  isEnabled,
  type CategoryTree,
} from '@/lib/budget-categories'

type FocusKey = 'budget' | 'emergency' | 'debt' | 'invest' | 'goal' | 'networth'

const FOCUS_OPTIONS: {
  key: FocusKey
  label: string
  desc: string
  icon: LucideIcon
}[] = [
  { key: 'budget', label: 'Ngerem pengeluaran', desc: 'Biar tahu uang lari ke mana tiap bulan', icon: Wallet },
  { key: 'emergency', label: 'Bangun dana darurat', desc: 'Bantalan buat keadaan tak terduga', icon: PiggyBank },
  { key: 'debt', label: 'Lunasi utang & paylater', desc: 'Susun strategi biar cepat bebas cicilan', icon: CreditCard },
  { key: 'invest', label: 'Mulai & rapikan investasi', desc: 'Pantau saham, reksa dana, emas, dll', icon: TrendingUp },
  { key: 'goal', label: 'Nabung tujuan besar', desc: 'Rumah, haji, nikah, qurban, pendidikan', icon: Target },
  { key: 'networth', label: 'Lihat kekayaan bersih', desc: 'Satu angka: total aset dikurangi utang', icon: LineChart },
]

const NEXT_ACTION: Record<FocusKey, { label: string; href: string; icon: LucideIcon }> = {
  budget: { label: 'Buat anggaran bulan ini', href: '/dashboard/budgeting', icon: Wallet },
  emergency: { label: 'Atur dana darurat', href: '/dashboard/emergency-fund', icon: PiggyBank },
  debt: { label: 'Catat utang & paylater', href: '/dashboard/debts', icon: CreditCard },
  invest: { label: 'Tambah investasi', href: '/dashboard/assets/investment', icon: TrendingUp },
  goal: { label: 'Bikin tujuan finansial', href: '/dashboard/goals', icon: Target },
  networth: { label: 'Lihat kekayaan bersih', href: '/dashboard/net-worth', icon: LineChart },
}

const ACCOUNT_TYPE_ENTRIES = Object.entries(ACCOUNT_TYPES) as [keyof typeof ACCOUNT_TYPES, string][]
const TOTAL_STEPS = 4
// UU PDP consent version — bump when the privacy/terms materially change so we
// can prompt existing users to re-consent later.
const CONSENT_VERSION = 'pdp-2026-06'

export function OnboardingWizard({ firstName }: { firstName: string }) {
  const router = useRouter()
  const t = useT()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [consent, setConsent] = useState(false)

  // Step 0 — fokus
  const [focus, setFocus] = useState<FocusKey[]>([])

  // Step 1 — akun pertama
  const [acctName, setAcctName] = useState('')
  const [acctType, setAcctType] = useState<keyof typeof ACCOUNT_TYPES>('bank')
  const [balanceRaw, setBalanceRaw] = useState('')

  // Step 2 — kategori pengeluaran
  const [tree, setTree] = useState<CategoryTree | null>(null)
  const [dbAvailable, setDbAvailable] = useState(true)
  const [disabledCats, setDisabledCats] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || !alive) return
      const { tree: t, dbAvailable: avail } = await loadTree(supabase, user.id)
      if (!alive) return
      setTree(t)
      setDbAvailable(avail)
      setDisabledCats(new Set(t.expense.filter((c) => !isEnabled(c)).map((c) => c.name)))
    })()
    return () => {
      alive = false
    }
  }, [])

  function toggleFocus(key: FocusKey) {
    setFocus((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function toggleCat(name: string) {
    setDisabledCats((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function complete(dest = '/dashboard') {
    if (submitting) return
    // UU PDP: explicit consent required before we finish setup / process data.
    if (!consent) {
      setStep(TOTAL_STEPS - 1)
      toast.error(t('onboarding.consent_required'))
      return
    }
    setSubmitting(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      router.replace('/login')
      return
    }

    // 1) Simpan fokus — best-effort, resilient kalau kolom belum ada (pre-039).
    try {
      // upsert (bukan update) + verify ter-tulis: update().eq() pada 0 baris
      // gak balikin error → onboarding_focus bisa tetap NULL → loop balik ke wizard.
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, onboarding_focus: focus }, { onConflict: 'id' })
        .select('id')
      if (error || !data?.length) console.warn('[onboarding] simpan fokus gagal:', error?.message)
    } catch (e) {
      console.warn('[onboarding] simpan fokus error:', e)
    }

    // 1b) Catat consent UU PDP — upsert terpisah & best-effort, supaya kalau
    // kolom belum ada (migration 046 belum di-apply) onboarding tetap jalan.
    try {
      const { error: consentErr } = await supabase
        .from('profiles')
        .upsert(
          { id: user.id, consent_at: new Date().toISOString(), consent_version: CONSENT_VERSION },
          { onConflict: 'id' },
        )
      // Jangan blokir onboarding kalau gagal, TAPI log (UU PDP: kita harus bisa
      // buktikan consent — kalau ini gagal diam-diam, ada user tanpa record consent).
      if (consentErr) console.warn('[onboarding] consent write gagal (migration 046 belum di-apply?):', consentErr.message)
    } catch (e) {
      console.warn('[onboarding] consent write error:', e)
    }

    // 2) Buat akun pertama kalau diisi.
    const name = acctName.trim()
    if (name) {
      const bal = Number(balanceRaw || '0')
      try {
        const { error } = await supabase.from('accounts').insert({
          user_id: user.id,
          name,
          type: acctType,
          starting_balance: bal,
          current_balance: bal,
        })
        if (error) toast.error(`${t('onboarding.account_save_failed')}: ${error.message}`)
      } catch {
        /* swallow — jangan sampai nge-block ke dashboard */
      }
    }

    // 3) Terapkan kategori pengeluaran yang dimatiin.
    if (tree) {
      const next: CategoryTree = {
        ...tree,
        expense: tree.expense.map((c) => ({
          ...c,
          enabled: disabledCats.has(c.name) ? false : undefined,
        })),
      }
      try {
        await saveTree(supabase, user.id, dbAvailable, next)
      } catch {
        /* swallow */
      }
    }

    toast.success(
      `${t('onboarding.toast_ready')}${firstName ? `, ${firstName}` : ''}! ${t('onboarding.toast_welcome')}`,
    )
    router.replace(dest)
  }

  const hello = firstName ? `${t('onboarding.hello')}, ${firstName}!` : `${t('onboarding.hello')}!`
  const expenseCats = tree?.expense ?? []
  const activeCatCount = expenseCats.filter((c) => !disabledCats.has(c.name)).length

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full" style={{ maxWidth: 600 }}>
        {/* Header: wordmark + progress */}
        <div className="flex items-center justify-between mb-5">
          <span className="t-title font-semibold" style={{ color: 'var(--c-primary-ink)' }}>
            Klunting
          </span>
          <div className="flex items-center gap-3">
            <span className="t-cap" style={{ color: 'var(--text-mute)' }}>
              {t('onboarding.step')} {step + 1} {t('onboarding.of')} {TOTAL_STEPS}
            </span>
            {step < TOTAL_STEPS - 1 && (
              <button
                type="button"
                onClick={() => complete()}
                disabled={submitting}
                className="t-cap transition hover:opacity-70"
                style={{ color: 'var(--text-mute)' }}
              >
                {t('onboarding.skip')}
              </button>
            )}
          </div>
        </div>

        {/* Segmented progress */}
        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: i <= step ? 'var(--c-primary)' : 'var(--line)' }}
            />
          ))}
        </div>

        <div className="s-card p-6 sm:p-8">
          {/* STEP 0 — Fokus */}
          {step === 0 && (
            <div>
              <h1 className="t-h2 mb-1.5" style={{ color: 'var(--ink)' }}>
                {hello} {t('onboarding.focus_title')}
              </h1>
              <p className="t-body mb-5" style={{ color: 'var(--ink-soft)' }}>
                {t('onboarding.focus_desc')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FOCUS_OPTIONS.map((opt) => {
                  const active = focus.includes(opt.key)
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleFocus(opt.key)}
                      className="text-left rounded-xl p-3.5 transition relative"
                      style={{
                        background: active ? 'var(--c-primary-soft)' : 'var(--surface)',
                        border: `1.5px solid ${active ? 'var(--c-primary)' : 'var(--line)'}`,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="size-9 rounded-[10px] flex items-center justify-center shrink-0"
                          style={{
                            background: active ? 'var(--c-primary)' : 'var(--bg)',
                            color: active ? '#fff' : 'var(--ink-soft)',
                          }}
                        >
                          <Icon className="size-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <p className="t-sm font-semibold" style={{ color: 'var(--ink)' }}>
                            {opt.label}
                          </p>
                          <p className="t-cap mt-0.5" style={{ color: 'var(--text-mute)' }}>
                            {opt.desc}
                          </p>
                        </div>
                      </div>
                      {active && (
                        <div
                          className="absolute top-2.5 right-2.5 size-4 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--c-primary)' }}
                        >
                          <Check className="size-3 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 1 — Akun pertama */}
          {step === 1 && (
            <div>
              <h1 className="t-h2 mb-1.5" style={{ color: 'var(--ink)' }}>
                {t('onboarding.account_title')}
              </h1>
              <p className="t-body mb-5" style={{ color: 'var(--ink-soft)' }}>
                {t('onboarding.account_desc')}
              </p>

              <label className="block t-sm font-medium mb-1.5" style={{ color: 'var(--ink)' }}>
                {t('onboarding.account_name_label')}
              </label>
              <input
                type="text"
                value={acctName}
                onChange={(e) => setAcctName(e.target.value)}
                placeholder={t('onboarding.account_name_placeholder')}
                className="w-full rounded-xl px-3.5 py-2.5 t-body outline-none transition mb-4"
                style={{
                  background: 'var(--surface)',
                  border: '1.5px solid var(--line)',
                  color: 'var(--ink)',
                }}
              />

              <label className="block t-sm font-medium mb-1.5" style={{ color: 'var(--ink)' }}>
                {t('onboarding.account_type_label')}
              </label>
              <div className="flex flex-wrap gap-2 mb-4">
                {ACCOUNT_TYPE_ENTRIES.map(([value, label]) => {
                  const active = acctType === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAcctType(value)}
                      className="rounded-full px-3.5 py-1.5 t-sm font-medium transition"
                      style={{
                        background: active ? 'var(--c-primary)' : 'var(--surface)',
                        color: active ? '#fff' : 'var(--ink-soft)',
                        border: `1.5px solid ${active ? 'var(--c-primary)' : 'var(--line)'}`,
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              <label className="block t-sm font-medium mb-1.5" style={{ color: 'var(--ink)' }}>
                {t('onboarding.account_balance_label')}
              </label>
              <div
                className="flex items-center rounded-xl px-3.5 py-2.5 mb-1"
                style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}
              >
                <span className="t-body mr-1.5" style={{ color: 'var(--text-mute)' }}>
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={balanceRaw ? Number(balanceRaw).toLocaleString('id-ID') : ''}
                  onChange={(e) => setBalanceRaw(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="0"
                  className="flex-1 bg-transparent outline-none num t-body"
                  style={{ color: 'var(--ink)' }}
                />
              </div>
              <p className="t-cap" style={{ color: 'var(--text-mute)' }}>
                {t('onboarding.account_balance_hint')}
              </p>
            </div>
          )}

          {/* STEP 2 — Kategori pengeluaran */}
          {step === 2 && (
            <div>
              <h1 className="t-h2 mb-1.5" style={{ color: 'var(--ink)' }}>
                {t('onboarding.categories_title')}
              </h1>
              <p className="t-body mb-5" style={{ color: 'var(--ink-soft)' }}>
                {t('onboarding.categories_desc')}
              </p>
              {tree == null ? (
                <div className="flex items-center gap-2 py-6 justify-center" style={{ color: 'var(--text-mute)' }}>
                  <Loader2 className="size-4 animate-spin" />
                  <span className="t-sm">{t('onboarding.categories_loading')}</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {expenseCats.map((c) => {
                      const on = !disabledCats.has(c.name)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCat(c.name)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 t-sm font-medium transition"
                          style={{
                            background: on ? 'var(--c-primary-soft)' : 'var(--surface)',
                            color: on ? 'var(--c-primary)' : 'var(--text-mute)',
                            border: `1.5px solid ${on ? 'var(--c-primary)' : 'var(--line)'}`,
                            opacity: on ? 1 : 0.7,
                          }}
                        >
                          {on ? <Check className="size-3.5" /> : null}
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                  <p className="t-cap" style={{ color: 'var(--text-mute)' }}>
                    <span className="num font-semibold">{activeCatCount}</span> {t('onboarding.categories_active')}
                  </p>
                </>
              )}
            </div>
          )}

          {/* STEP 3 — Selesai */}
          {step === 3 && (
            <div>
              <div
                className="size-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'var(--c-primary)' }}
              >
                <Check className="size-6 text-white" />
              </div>
              <h1 className="t-h2 mb-1.5" style={{ color: 'var(--ink)' }}>
                {t('onboarding.done_title')}{firstName ? `, ${firstName}` : ''}!
              </h1>
              <p className="t-body mb-5" style={{ color: 'var(--ink-soft)' }}>
                {focus.length > 0
                  ? t('onboarding.done_desc_focused')
                  : t('onboarding.done_desc_default')}
              </p>

              {/* UU PDP consent — wajib dicentang sebelum selesai */}
              <label
                className="flex items-start gap-2.5 mb-4 cursor-pointer rounded-xl p-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0"
                  style={{ accentColor: 'var(--c-primary)' }}
                />
                <span className="t-sm" style={{ color: 'var(--ink-soft)' }}>
                  {t('onboarding.consent_text')}{' '}
                  <Link href="/privacy" target="_blank" className="underline" style={{ color: 'var(--ink)' }}>{t('onboarding.consent_privacy')}</Link>
                  {' '}{t('onboarding.consent_and')}{' '}
                  <Link href="/terms" target="_blank" className="underline" style={{ color: 'var(--ink)' }}>{t('onboarding.consent_terms')}</Link>.
                </span>
              </label>

              <div className="space-y-2 mb-2">
                {(focus.length > 0 ? focus : (['budget', 'networth'] as FocusKey[])).map((k) => {
                  const a = NEXT_ACTION[k]
                  const Icon = a.icon
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => void complete(a.href)}
                      disabled={submitting}
                      className="w-full text-left flex items-center gap-3 rounded-xl px-4 py-3 transition"
                      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                    >
                      <div
                        className="size-8 rounded-[10px] flex items-center justify-center shrink-0"
                        style={{ background: 'var(--c-primary-soft)', color: 'var(--c-primary-ink)' }}
                      >
                        <Icon className="size-4" />
                      </div>
                      <span className="t-sm font-medium flex-1" style={{ color: 'var(--ink)' }}>
                        {a.label}
                      </span>
                      <ChevronRight className="size-4" style={{ color: 'var(--text-mute)' }} />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between mt-5">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={submitting}
              className="inline-flex items-center gap-1 t-sm font-medium transition hover:opacity-70"
              style={{ color: 'var(--ink-soft)' }}
            >
              <ChevronLeft className="size-4" />
              {t('onboarding.back')}
            </button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              {t('onboarding.next')}
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => complete()}
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('onboarding.open_dashboard')}
              {!submitting && <ArrowRight className="size-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
