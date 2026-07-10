'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Flag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Playbook } from '@/lib/playbooks'
import { playbookIcon } from '@/components/playbook/icons'
import { useT } from '@/lib/i18n/context'
import { formatRupiahPlain as formatRp } from '@/lib/utils'

interface PlanResult {
  ringkasan: string
  targetTotal: number
  sisaKurang?: number
  setoranBulanan: number
  estimasiSelesai: string
  milestones: { judul: string; target: string; kapan: string }[]
  tips: string[]
  perhatian?: string[]
}

export function PlaybookDetail({ playbook }: { playbook: Playbook }) {
  const t = useT()
  const Icon = playbookIcon(playbook.iconKey)

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of playbook.inputs) {
      init[f.key] = f.type === 'select' ? f.options?.[0]?.value ?? '' : ''
    }
    return init
  })
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [plan, setPlan] = useState<PlanResult | null>(null)
  // Saat fokus, tampilkan digit mentah (tanpa reformat ribuan) biar caret
  // gak lompat ke akhir tiap ketikan di tengah nilai.
  const [focusKey, setFocusKey] = useState<string | null>(null)
  // Teks pakai varian -ink (AA); accent full-sat cuma buat ikon & tint.
  const accentInk = playbook.accent.replace(/\)$/, '-ink)')
  const hasNumberInput = playbook.inputs.some((f) => f.type === 'number' && values[f.key] !== '' && values[f.key] != null)

  // Prefill angka dari data user — best-effort (saldo likuid + arus kas bulan ini).
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || !alive) return

        const { data: acctsRaw } = await supabase
          .from('accounts')
          .select('type, current_balance')
          .eq('user_id', user.id)
        const accts = (acctsRaw ?? []) as unknown as { type: string; current_balance: number }[]
        const liquid = accts
          .filter((a) => ['cash', 'bank', 'digital_wallet'].includes(a.type))
          .reduce((s, a) => s + Number(a.current_balance || 0), 0)

        // Rata-rata 3 bulan PENUH terakhir — bulan berjalan masih parsial
        // (tanggal 12 angkanya baru ~40%) dan bakal sistematis ngecilin
        // target dana darurat / penilaian kemampuan cicilan.
        // Kategori 'Transfer' (pindah antar-akun, 2 leg expense+income)
        // WAJIB di-exclude — konvensi yang sama dengan dashboard.
        const now = new Date()
        const monthFirst = (offset: number) => {
          const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
        }
        const { data: txsRaw } = await supabase
          .from('transactions')
          .select('type, amount, category, date')
          .eq('user_id', user.id)
          .gte('date', monthFirst(-3))
          .lt('date', monthFirst(0))
        const txs = (txsRaw ?? []) as unknown as { type: string; amount: number; category: string | null; date: string }[]
        let inc = 0
        let exp = 0
        const monthsSeen = new Set<string>()
        for (const t of txs) {
          if (t.category === 'Transfer') continue
          const amt = Number(t.amount || 0)
          if (t.type === 'income') inc += amt
          else if (t.type === 'expense') exp += amt
          else continue
          monthsSeen.add(String(t.date).slice(0, 7))
        }
        // Bagi pakai bulan yang BENERAN ada datanya (user baru < 3 bulan).
        const months = Math.max(1, Math.min(3, monthsSeen.size))

        const prefill: Record<string, number> = {
          liquidSavings: liquid,
          monthlyIncome: Math.round(inc / months),
          monthlyExpense: Math.round(exp / months),
        }
        if (!alive) return
        setValues((prev) => {
          const next = { ...prev }
          for (const f of playbook.inputs) {
            if (f.prefillFrom && !next[f.key]) {
              const v = prefill[f.prefillFrom]
              if (v && v > 0) next[f.key] = String(Math.round(v))
            }
          }
          return next
        })
      } catch {
        /* prefill optional — abaikan kalau gagal */
      }
    })()
    return () => {
      alive = false
    }
  }, [playbook])

  function setNumber(key: string, raw: string, decimal = false) {
    const cleaned = decimal
      ? raw.replace(/[^\d.,]/g, '').replace(',', '.').replace(/(\..*)\./g, '$1')
      : raw.replace(/[^\d]/g, '')
    setValues((v) => ({ ...v, [key]: cleaned }))
  }

  async function generate() {
    if (loadingPlan) return
    setLoadingPlan(true)
    try {
      const inputs: Record<string, string | number> = {}
      for (const f of playbook.inputs) {
        const raw = values[f.key]
        if (raw === '' || raw == null) continue
        inputs[f.key] = f.type === 'number' ? Number(raw) : raw
      }
      // Tanggal LOKAL — toISOString itu UTC, mundur sehari buat WIB sebelum 07.00.
      const d = new Date()
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const res = await fetch('/api/playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: playbook.slug,
          inputs,
          today,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? t('playbook_detail.toast_failed'))
        return
      }
      setPlan(json.data as PlanResult)
      // Generate makan 8 kredit — badge kredit di header ikut refresh.
      window.dispatchEvent(new CustomEvent('pwm:ai-credits-changed'))
      toast.success(t('playbook_detail.toast_ready'))
    } catch {
      toast.error(t('playbook_detail.toast_connect_failed'))
    } finally {
      setLoadingPlan(false)
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <Link
        href="/dashboard/playbook"
        className="inline-flex items-center gap-1 t-sm transition hover:opacity-70"
        style={{ color: 'var(--ink-soft)' }}
      >
        <ArrowLeft className="size-4" />
        {t('playbook_detail.all_playbooks')}
      </Link>

      {/* Header */}
      <header className="flex items-start gap-3.5">
        <div
          className="size-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in oklab, ${playbook.accent} 14%, transparent)`, color: playbook.accent }}
        >
          <Icon className="size-6" />
        </div>
        <div>
          <h1
            className="tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}
          >
            {playbook.title}
          </h1>
          <p className="t-body mt-1.5 max-w-2xl" style={{ color: 'var(--ink-soft)' }}>
            {playbook.intro}
          </p>
        </div>
      </header>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Langkah-langkah */}
        <section className="s-card p-5 sm:p-6">
          <h2 className="t-title font-semibold mb-4" style={{ color: 'var(--ink)' }}>
            {t('playbook_detail.steps_title')}
          </h2>
          <ol className="space-y-4">
            {playbook.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <div
                  className="size-6 rounded-full flex items-center justify-center shrink-0 num font-semibold"
                  style={{
                    background: `color-mix(in oklab, ${playbook.accent} 14%, transparent)`,
                    color: accentInk,
                    fontSize: 12,
                  }}
                >
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="t-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {s.title}
                  </p>
                  <p className="t-sm mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                    {s.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Form rencana */}
        <section className="s-card p-5 sm:p-6 h-fit">
          <h2 className="t-title font-semibold mb-1" style={{ color: 'var(--ink)' }}>
            {t('playbook_detail.form_title')}
          </h2>
          <p className="t-sm mb-4" style={{ color: 'var(--text-mute)' }}>
            {t('playbook_detail.form_desc')}
          </p>

          <div className="space-y-3">
            {playbook.inputs.map((f) => (
              <div key={f.key}>
                <label htmlFor={`pb-${f.key}`} className="block t-sm font-medium mb-1.5" style={{ color: 'var(--ink)' }}>
                  {f.label}
                </label>
                {f.type === 'select' ? (
                  <div className="relative">
                    <select
                      id={`pb-${f.key}`}
                      value={values[f.key]}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="w-full rounded-xl pl-3.5 pr-9 py-2.5 t-body transition appearance-none"
                      style={{ background: 'var(--surface)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="size-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ink-soft)' }} />
                  </div>
                ) : (
                  <div
                    className="flex items-center rounded-xl px-3.5 py-2.5 border-[1.5px] border-[var(--line)] transition focus-within:border-[var(--ink)]"
                    style={{ background: 'var(--surface)' }}
                  >
                    {f.prefix && (
                      <span className="t-body mr-1.5 shrink-0" style={{ color: 'var(--text-mute)' }}>
                        {f.prefix}
                      </span>
                    )}
                    <input
                      id={`pb-${f.key}`}
                      type="text"
                      inputMode={f.decimal ? 'decimal' : 'numeric'}
                      value={
                        f.prefix === 'Rp' && values[f.key] && focusKey !== f.key
                          ? Number(values[f.key]).toLocaleString('id-ID')
                          : values[f.key]
                      }
                      onFocus={() => setFocusKey(f.key)}
                      onBlur={() => setFocusKey(null)}
                      onChange={(e) => setNumber(f.key, e.target.value, f.decimal)}
                      placeholder={f.placeholder}
                      className="flex-1 min-w-0 bg-transparent outline-none num t-body"
                      style={{ color: 'var(--ink)' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={loadingPlan || !hasNumberInput}
            className="btn-primary w-full mt-5 inline-flex items-center justify-center gap-2"
          >
            {loadingPlan ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loadingPlan
              ? t('playbook_detail.btn_generating')
              : plan
                ? t('playbook_detail.btn_regenerate')
                : t('playbook_detail.btn_generate')}
          </button>
          <p className="t-cap text-center mt-2" style={{ color: 'var(--text-mute)' }}>
            {t('playbook_detail.credits_note')}
          </p>
        </section>
      </div>

      {/* Hasil rencana */}
      {plan && (
        <section className="s-card p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-4" style={{ color: playbook.accent }} />
            <h2 className="t-title font-semibold" style={{ color: 'var(--ink)' }}>
              {t('playbook_detail.plan_title')}
            </h2>
          </div>

          <p className="t-body mb-5" style={{ color: 'var(--ink-soft)' }}>
            {plan.ringkasan}
          </p>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <Stat label={t('playbook_detail.stat_target_total')} value={formatRp(plan.targetTotal)} accent={accentInk} />
            <Stat label={t('playbook_detail.stat_monthly')} value={formatRp(plan.setoranBulanan)} accent={accentInk} />
            <Stat label={t('playbook_detail.stat_estimate')} value={plan.estimasiSelesai} accent={accentInk} isText />
          </div>

          {/* Milestones */}
          {plan.milestones?.length > 0 && (
            <div className="mb-5">
              <p className="eyebrow mb-2.5" style={{ color: 'var(--text-mute)' }}>
                {t('playbook_detail.milestone_label')}
              </p>
              <div className="space-y-2.5">
                {plan.milestones.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                  >
                    <Flag className="size-4 mt-0.5 shrink-0" style={{ color: playbook.accent }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="t-sm font-semibold" style={{ color: 'var(--ink)' }}>
                          {m.judul}
                        </p>
                        <span className="t-cap shrink-0" style={{ color: 'var(--text-mute)' }}>
                          {m.kapan}
                        </span>
                      </div>
                      <p className="t-sm num mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                        {m.target}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {plan.tips?.length > 0 && (
            <div className="mb-5">
              <p className="eyebrow mb-2.5" style={{ color: 'var(--text-mute)' }}>
                {t('playbook_detail.tips_label')}
              </p>
              <ul className="space-y-2">
                {plan.tips.map((t, i) => (
                  <li key={i} className="flex gap-2.5">
                    <Lightbulb className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--c-amber)' }} />
                    <span className="t-sm" style={{ color: 'var(--ink-soft)' }}>
                      {t}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Perhatian */}
          {plan.perhatian && plan.perhatian.length > 0 && (
            <div
              className="rounded-xl px-4 py-3 mb-1"
              style={{ background: 'color-mix(in oklab, var(--c-amber) 10%, transparent)' }}
            >
              <ul className="space-y-1.5">
                {plan.perhatian.map((p, i) => (
                  <li key={i} className="flex gap-2.5">
                    <AlertTriangle className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--c-amber)' }} />
                    <span className="t-sm" style={{ color: 'var(--ink-soft)' }}>
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="t-cap mt-4" style={{ color: 'var(--text-mute)' }}>
            {t('playbook_detail.disclaimer')}
          </p>
        </section>
      )}

      {/* Related CTA */}
      {playbook.related && (
        <Link
          href={playbook.related.href}
          className="s-card p-4 flex items-center gap-3 transition hover:shadow-md"
        >
          <div
            className="size-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--c-primary-soft)', color: 'var(--c-primary)' }}
          >
            <ChevronRight className="size-5" />
          </div>
          <div className="flex-1">
            <p className="t-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {playbook.related.label}
            </p>
            <p className="t-cap" style={{ color: 'var(--text-mute)' }}>
              {t('playbook_detail.related_caption')}
            </p>
          </div>
        </Link>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  isText,
}: {
  label: string
  value: string
  accent: string
  isText?: boolean
}) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <p className="t-cap mb-1" style={{ color: 'var(--text-mute)' }}>
        {label}
      </p>
      <p
        className={isText ? 't-sm font-semibold' : 't-title num font-semibold'}
        style={{ color: isText ? 'var(--ink)' : accent }}
      >
        {value}
      </p>
    </div>
  )
}
