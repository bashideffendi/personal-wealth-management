'use client'

/**
 * Mobile budgeting view — layar Anggaran versi F13d (redesign mobile, ala app
 * Budget).
 *
 * Fokus SATU bulan (switcher ◀ ▶), lalu:
 *   1. Kartu ringkasan ala Budget: donut multi-segmen (share alokasi per
 *      kategori INDUK expense — rollup SUB_SEP, warna categoryHue) + label
 *      "Bulanan" + total alokasi bulan + subline "~Rp X per hari"; di bawahnya
 *      (kartu yang sama) list ringkas per induk: chip ikon + % share + nominal.
 *   2. Strip coral ramping kalau rencana alokasi > rencana pendapatan
 *      (over-alokasi) — pengganti banner gede desktop.
 *   3. List ala Budget: TIAP kategori induk EXPENSE = KARTU s-card SENDIRI —
 *      header kartu = chip ikon hue + nama (+chevron collapse kalau ber-sub)
 *      + nominal di PILL abu kanan (compact + detail act/plan di title);
 *      sub-item = baris di dalam kartu (pill lebih kecil). Induk tanpa sub =
 *      kartu satu baris. Income/saving/investment digabung SATU kartu per
 *      tipe (header label tipe + total pill) biar halaman gak kepanjangan.
 *      Tiap baris leaf punya bar realisasi tipis di bawahnya (info act/plan).
 *   4. Toggle floating "Rencana | Sisa" (pill terang translucent) di atas
 *      dock: mode Sisa mengganti angka kanan baris jadi (anggaran −
 *      realisasi), negatif = coral.
 *
 * Edit nominal TETAP bisa (canonical input = prinsip produk): tap angka di
 * kanan baris leaf → NumberInput compact autofocus, commit saat blur/Enter.
 *
 * Terima data + callback yang sama dgn grid desktop; realisasi via prop
 * `actuals` (key `type::cat::month`) — sudah dihitung halaman, no query baru.
 */

import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Info } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { NumberInput } from '@/components/ui/number-input'
import { CategoryIcon } from '@/components/transactions/category-icon'
import { categoryHue } from '@/lib/category-hue'
import { usePrivacy } from '@/components/privacy/privacy-provider'
import { useI18n } from '@/lib/i18n/context'
import { monthLong } from '@/lib/i18n/dates'
import { SUB_SEP, rootCategory } from '@/lib/budget-categories'

type BudgetType = 'income' | 'expense' | 'saving' | 'investment'

interface MobileBudgetingViewProps {
  year: number
  visibleIncome: string[]
  visibleExpense: string[]
  visibleSaving: string[]
  visibleInvestment: string[]
  getValue: (type: string, category: string, month: number) => number
  /** Realisasi per `${type}::${category}::${month}` dari loadMonthlyActuals. */
  actuals: Record<string, number>
  onCellChange: (type: BudgetType, category: string, month: number, value: number) => void | Promise<void>
  /** Total semua nilai anggaran (semua tipe) satu bulan — deteksi bulan kosong. */
  monthAllocTotal: (month: number) => number
  /** Total anggaran bulan sebelumnya (Jan → Des tahun-1, dihitung halaman). */
  prevMonthAllocTotal: (month: number) => number
  /** Salin semua anggaran bulan lalu ke bulan ini (batch upsert di halaman). */
  onCopyPrevMonth: (month: number) => void | Promise<void>
}

// labelKey → i18n (Pendapatan/Pengeluaran/Tabungan/Investasi ikut locale)
const SECTIONS: { key: BudgetType; labelKey: string }[] = [
  { key: 'income',     labelKey: 'budgeting.income' },
  { key: 'expense',    labelKey: 'budgeting.expense' },
  { key: 'saving',     labelKey: 'budgeting.saving' },
  { key: 'investment', labelKey: 'budgeting.investment' },
]

/**
 * Kelompokkan leaf berurutan: sub-sub (SUB_SEP) satu induk jadi satu grup
 * collapsible; induk tanpa sub = grup ber-root null berisi satu leaf.
 */
function buildGroups(cats: string[]): { root: string | null; cats: string[] }[] {
  const groups: { root: string | null; cats: string[] }[] = []
  for (const cat of cats) {
    const i = cat.indexOf(SUB_SEP)
    const root = i === -1 ? null : cat.slice(0, i)
    const last = groups[groups.length - 1]
    if (root !== null && last && last.root === root) last.cats.push(cat)
    else groups.push({ root, cats: [cat] })
  }
  return groups
}

interface DonutSegment {
  key: string
  color: string
  /** Porsi 0..1 dari lingkaran penuh. */
  frac: number
}

/**
 * Donut multi-segmen ala Budget — tiap segmen = share alokasi satu kategori
 * induk (warna hue kategori), track abu di belakang, tengah kosong.
 * Murni dekoratif (aria-hidden) — angka & list di sebelahnya yang informatif.
 */
function AllocationDonut({
  segments,
  size = 84,
  strokeWidth = 10,
}: {
  segments: DonutSegment[]
  size?: number
  strokeWidth?: number
}) {
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const center = size / 2
  // Offset kumulatif per segmen tanpa mutasi closure saat render (React
  // Compiler immutability) — offset = jumlah frac segmen-segmen sebelumnya.
  const offsets = segments.map((_, i) =>
    segments.slice(0, i).reduce((s, sg) => s + Math.max(0, sg.frac), 0),
  )
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle cx={center} cy={center} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={strokeWidth} />
      <g transform={`rotate(-90 ${center} ${center})`}>
        {segments.map((seg, i) => {
          const len = Math.max(0, seg.frac) * c
          const offset = -offsets[i] * c
          if (len <= 0) return null
          return (
            <circle
              key={seg.key}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={offset}
            />
          )
        })}
      </g>
    </svg>
  )
}

export function MobileBudgetingView({
  year,
  visibleIncome,
  visibleExpense,
  visibleSaving,
  visibleInvestment,
  getValue,
  actuals,
  onCellChange,
  monthAllocTotal,
  prevMonthAllocTotal,
  onCopyPrevMonth,
}: MobileBudgetingViewProps) {
  const { t, locale } = useI18n()
  const { hidden: privacyHidden } = usePrivacy()
  const today = new Date()
  const initialMonth =
    today.getFullYear() === year ? today.getMonth() + 1 : 1
  const [month, setMonth] = useState(initialMonth)

  // Edit inline satu baris: tap angka → NumberInput, commit saat blur.
  const [editing, setEditing] = useState<{ key: string; value: number } | null>(null)

  // Guard anti double-tap saat batch upsert "Salin dari bulan lalu" jalan.
  const [copying, setCopying] = useState(false)

  // Toggle floating "Rencana | Sisa": plan = "realisasi / anggaran" (existing),
  // remain = angka kanan jadi sisa (anggaran − realisasi).
  const [view, setView] = useState<'plan' | 'remain'>('plan')

  // Induk ber-sub yang lagi ke-expand (default: SEMUA expand — collapse manual).
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>()
    const all: [BudgetType, string[]][] = [
      ['income', visibleIncome],
      ['expense', visibleExpense],
      ['saving', visibleSaving],
      ['investment', visibleInvestment],
    ]
    for (const [type, cats] of all) {
      for (const cat of cats) {
        const i = cat.indexOf(SUB_SEP)
        if (i !== -1) s.add(`${type}|${cat.slice(0, i)}`)
      }
    }
    return s
  })

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const visibleByType: Record<BudgetType, string[]> = {
    income: visibleIncome,
    expense: visibleExpense,
    saving: visibleSaving,
    investment: visibleInvestment,
  }

  const actualOf = (type: BudgetType, cat: string) => actuals[`${type}::${cat}::${month}`] ?? 0
  const planTotal = (type: BudgetType) =>
    visibleByType[type].reduce((s, c) => s + getValue(type, c, month), 0)
  const actualTotal = (type: BudgetType) =>
    visibleByType[type].reduce((s, c) => s + actualOf(type, c), 0)

  // Total alokasi bulan (rencana E+T+I) — definisi "Dialokasikan" sama dgn
  // Ringkasan Alokasi desktop.
  const allocated = planTotal('expense') + planTotal('saving') + planTotal('investment')
  const daysInMonth = new Date(year, month, 0).getDate()
  const perDay = allocated / daysInMonth

  // Rollup alokasi expense per kategori INDUK (sub SUB_SEP digabung ke induknya)
  // → bahan donut multi-segmen + list ringkas di kartu ringkasan.
  const expenseParents: { name: string; amount: number }[] = (() => {
    const map = new Map<string, number>()
    for (const cat of visibleExpense) {
      const root = rootCategory(cat)
      map.set(root, (map.get(root) ?? 0) + getValue('expense', cat, month))
    }
    return [...map.entries()].map(([name, amount]) => ({ name, amount }))
  })()
  const expenseAlloc = expenseParents.reduce((s, p) => s + p.amount, 0)
  const donutParents = expenseParents.filter((p) => p.amount > 0)

  // Over-alokasi RENCANA (zero-based): alokasi melebihi rencana pendapatan.
  const incomePlan = planTotal('income')
  const overAlloc = incomePlan > 0 && allocated > incomePlan

  const compact = (n: number) => (privacyHidden ? 'Rp ••••' : formatCompactCurrency(n))
  const full = (n: number) => (privacyHidden ? undefined : formatCurrency(n))

  // Nominal pill (konvensi compact + title full): plan mode = rencana (over
  // expense = coral-ink), remain mode = sisa anggaran−realisasi (negatif =
  // coral-ink + −).
  const pillText = (plan: number, act: number) =>
    view === 'remain'
      ? `${plan - act < 0 ? '−' : ''}${compact(Math.abs(plan - act))}`
      : compact(plan)
  const pillColor = (type: BudgetType, plan: number, act: number) =>
    view === 'remain'
      ? plan - act < 0
        ? 'var(--c-coral-ink)'
        : 'var(--ink)'
      : type === 'expense' && plan > 0 && act > plan
        ? 'var(--c-coral-ink)'
        : 'var(--ink)'
  const pillTitle = (plan: number, act: number) =>
    privacyHidden ? undefined : `${formatCurrency(act)} / ${formatCurrency(plan)}`

  function prev() {
    setMonth((m) => (m === 1 ? 12 : m - 1))
  }
  function next() {
    setMonth((m) => (m === 12 ? 1 : m + 1))
  }

  function commitEdit(type: BudgetType, cat: string) {
    if (!editing) return
    const v = editing.value
    setEditing(null)
    if (v !== getValue(type, cat, month)) void onCellChange(type, cat, month, v)
  }

  // Baris leaf (induk tanpa sub, atau sub-item dalam kartu induknya) — nama
  // kiri, nominal pill kanan yang bisa di-TAP untuk edit (NumberInput compact,
  // commit blur/Enter), plus bar realisasi tipis di bawah baris.
  const renderLeafRow = (
    type: BudgetType,
    cat: string,
    opts: { border: boolean; sub: boolean },
  ) => {
    const plan = getValue(type, cat, month)
    const act = actualOf(type, cat)
    const overRow = type === 'expense' && plan > 0 && act > plan
    const sepIdx = cat.indexOf(SUB_SEP)
    const label = sepIdx === -1 ? cat : cat.slice(sepIdx + SUB_SEP.length)
    // F10: hue kategori — sub ikut hue induknya biar satu keluarga.
    const hue = categoryHue(sepIdx === -1 ? cat : cat.slice(0, sepIdx))
    const rowKey = `${type}|${cat}`
    const isEditing = editing?.key === rowKey
    return (
      <div
        key={cat}
        className="py-2"
        style={{ borderTop: opts.border ? '1px solid var(--border-soft)' : 'none' }}
      >
        <div className="flex items-center justify-between gap-2 min-h-[24px]">
          <span className="flex items-center gap-2 min-w-0">
            {!opts.sub && (
              <span
                className="grid place-items-center size-6 rounded-[8px] shrink-0"
                style={{ background: hue.soft, color: hue.ink }}
              >
                <CategoryIcon category={label} className="size-[13px]" />
              </span>
            )}
            <p
              className={`${opts.sub ? 'text-[12px]' : 'text-[12.5px]'} font-medium truncate`}
              style={{ color: 'var(--ink)' }}
              title={cat}
            >
              {label}
            </p>
          </span>
          {isEditing ? (
            <NumberInput
              autoFocus
              value={editing.value}
              onChange={(n) => setEditing({ key: rowKey, value: n })}
              onBlur={() => commitEdit(type, cat)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              placeholder="0"
              className="h-8 w-[110px] shrink-0 text-right text-[13px]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing({ key: rowKey, value: plan })}
              className="shrink-0 active:opacity-60 transition-opacity"
              title={pillTitle(plan, act)}
            >
              <span
                className={`num tabular rounded-full ${
                  opts.sub
                    ? 'px-2 py-0.5 text-[11.5px] font-medium'
                    : 'px-2.5 py-1 text-[12.5px] font-semibold'
                }`}
                style={{ background: 'var(--surface-2)', color: pillColor(type, plan, act) }}
              >
                {pillText(plan, act)}
              </span>
            </button>
          )}
        </div>
        {plan > 0 && (
          <div
            className="mt-1.5 h-[3px] overflow-hidden rounded-full"
            style={{ background: 'var(--surface-2)' }}
            aria-hidden
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (act / plan) * 100)}%`,
                background: overRow ? 'var(--c-coral-ink)' : hue.bar,
              }}
            />
          </div>
        )}
      </div>
    )
  }

  // Header grup induk ber-sub: button collapse (chip + nama + chevron) dan
  // pill rollup adalah SIBLING (bukan button dalam button) — angka induk =
  // jumlah sub, bukan tempat edit.
  const renderGroupHeader = (
    type: BudgetType,
    root: string,
    cats: string[],
    opts: { border: boolean },
  ) => {
    const gKey = `${type}|${root}`
    const isOpen = expanded.has(gKey)
    const gPlan = cats.reduce((s, c) => s + getValue(type, c, month), 0)
    const gAct = cats.reduce((s, c) => s + actualOf(type, c), 0)
    const hue = categoryHue(root)
    return (
      <div
        className="flex min-h-[24px] items-center justify-between gap-2 py-2"
        style={{ borderTop: opts.border ? '1px solid var(--border-soft)' : 'none' }}
      >
        <button
          type="button"
          onClick={() => toggleExpanded(gKey)}
          aria-expanded={isOpen}
          className="flex flex-1 items-center gap-2 min-w-0 text-left active:opacity-70 transition-opacity"
        >
          <span
            className="grid place-items-center size-6 rounded-[8px] shrink-0"
            style={{ background: hue.soft, color: hue.ink }}
          >
            <CategoryIcon category={root} className="size-[13px]" />
          </span>
          <span className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--ink)' }} title={root}>
            {root}
          </span>
          <ChevronDown
            className="size-3.5 shrink-0 transition-transform"
            style={{ color: 'var(--ink-soft)', transform: isOpen ? 'rotate(180deg)' : 'none' }}
          />
        </button>
        <span
          className="num tabular shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
          style={{ background: 'var(--surface-2)', color: pillColor(type, gPlan, gAct) }}
          title={pillTitle(gPlan, gAct)}
        >
          {pillText(gPlan, gAct)}
        </span>
      </div>
    )
  }

  return (
    <div className="pb-12">
      {/* Month switcher — baris header ramping ala Budget: chevron polos
          mengapit nama bulan, tanpa kartu/border */}
      <div className="flex items-center justify-center gap-3 py-1">
        <button
          type="button"
          onClick={prev}
          className="p-2 active:opacity-60"
          aria-label={t('mobile_budget.prev_month')}
        >
          <ChevronLeft className="size-4" style={{ color: 'var(--ink-soft)' }} />
        </button>
        <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
          {monthLong(month - 1, locale)} {year}
        </p>
        <button
          type="button"
          onClick={next}
          className="p-2 active:opacity-60"
          aria-label={t('mobile_budget.next_month')}
        >
          <ChevronRight className="size-4" style={{ color: 'var(--ink-soft)' }} />
        </button>
      </div>

      {/* Salin dari bulan lalu — HANYA saat bulan terpilih kosong total.
          Setelah tersalin (optimistic), total > 0 → baris ini hilang sendiri. */}
      {monthAllocTotal(month) === 0 && (() => {
        const prevEmpty = prevMonthAllocTotal(month) === 0
        return (
          <div className="flex flex-col items-center gap-1 pt-1">
            <button
              type="button"
              disabled={prevEmpty || copying}
              onClick={async () => {
                setCopying(true)
                try {
                  await onCopyPrevMonth(month)
                } finally {
                  setCopying(false)
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-opacity active:opacity-70 disabled:opacity-45"
              style={{ borderColor: 'var(--outline)', background: 'var(--surface)', color: 'var(--ink)' }}
            >
              <Copy className="size-3.5" style={{ color: 'var(--ink-soft)' }} />
              {locale === 'id' ? 'Salin dari bulan lalu' : 'Copy from last month'}
            </button>
            {prevEmpty && (
              <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                {locale === 'id' ? 'Bulan lalu juga kosong' : 'Last month is empty too'}
              </p>
            )}
          </div>
        )
      })()}

      {/* Kartu ringkasan ala Budget — F13d: donut multi-segmen share alokasi
          induk expense + total alokasi bulan + list ringkas per induk */}
      <section className="s-card px-4 py-3.5 mt-3">
        <div className="flex items-center gap-4">
          <AllocationDonut
            segments={donutParents.map((p) => ({
              key: p.name,
              color: categoryHue(p.name).bar,
              frac: expenseAlloc > 0 ? p.amount / expenseAlloc : 0,
            }))}
          />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide font-medium" style={{ color: 'var(--ink-soft)' }}>
              {t('recurring.freq_monthly')}
            </p>
            <p
              className="num tabular font-semibold mt-0.5"
              style={{ fontSize: 27, letterSpacing: '-0.02em', color: 'var(--ink)' }}
            >
              {privacyHidden ? 'Rp ••••' : formatCurrency(allocated)}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
              ~{privacyHidden
                ? 'Rp ••••'
                : new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(perDay)}{' '}
              {locale === 'id' ? 'per hari' : 'per day'}
            </p>
          </div>
        </div>

        {/* List ringkas per kategori induk — share & nominal alokasi (info,
            bukan tempat edit; edit tetap di list per tipe di bawah) */}
        {donutParents.length > 0 && (
          <div className="mt-3 pt-1.5" style={{ borderTop: '1px solid var(--border-soft)' }}>
            {donutParents.map((p) => {
              const hue = categoryHue(p.name)
              const share = expenseAlloc > 0 ? (p.amount / expenseAlloc) * 100 : 0
              return (
                <div key={p.name} className="flex items-center gap-2 py-1.5">
                  <span
                    className="grid place-items-center size-6 rounded-[8px] shrink-0"
                    style={{ background: hue.soft, color: hue.ink }}
                  >
                    <CategoryIcon category={p.name} className="size-[13px]" />
                  </span>
                  <span className="flex-1 min-w-0 flex items-baseline gap-2">
                    <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)' }} title={p.name}>
                      {p.name}
                    </p>
                    <span className="num tabular text-[11px] shrink-0" style={{ color: 'var(--ink-soft)' }}>
                      {share.toFixed(2).replace('.', ',')}%
                    </span>
                  </span>
                  <span
                    className="num tabular text-[12px] font-medium shrink-0 min-w-[88px] text-right"
                    style={{ color: 'var(--ink)' }}
                  >
                    {privacyHidden ? '••••' : formatCurrency(p.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Strip over-alokasi (rencana > pendapatan) — ramping, bukan banner */}
      {overAlloc && (
        <div className="mt-2 flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ background: 'var(--c-coral-soft)' }}>
          <Info className="size-3.5 shrink-0" style={{ color: 'var(--c-coral-ink)' }} />
          <p className="text-[11.5px] font-medium leading-tight" style={{ color: 'var(--c-coral-ink)' }}>
            <span className="num tabular font-semibold" title={full(allocated - incomePlan)}>
              {compact(allocated - incomePlan)}
            </span>{' '}
            {t('budgeting.alloc_banner_over')}
          </p>
        </div>
      )}

      {/* List ala Budget — expense: TIAP kategori induk = kartu sendiri;
          income/saving/investment: SATU kartu per tipe di bawahnya */}
      <div className="mt-3 space-y-2.5">
        {buildGroups(visibleExpense).map((g) => {
          // Induk tanpa sub = kartu satu baris (angka tetap editable).
          if (g.root === null) {
            return (
              <section key={`expense|${g.cats[0]}`} className="s-card px-3.5 py-1">
                {renderLeafRow('expense', g.cats[0], { border: false, sub: false })}
              </section>
            )
          }
          // Induk ber-sub = kartu dengan header collapse + baris sub di dalam.
          const gKey = `expense|${g.root}`
          return (
            <section key={gKey} className="s-card px-3.5 py-1">
              {renderGroupHeader('expense', g.root, g.cats, { border: false })}
              {expanded.has(gKey) &&
                g.cats.map((cat) => renderLeafRow('expense', cat, { border: true, sub: true }))}
            </section>
          )
        })}

        {/* Kompromi anti-kepanjangan: tipe non-expense masing-masing SATU
            kartu — header label tipe + total pill, isi baris kategori */}
        {SECTIONS.filter((s) => s.key !== 'expense').map((section) => {
          const cats = visibleByType[section.key]
          if (cats.length === 0) return null
          const secPlan = planTotal(section.key)
          const secActual = actualTotal(section.key)
          return (
            <section key={section.key} className="s-card px-3.5 py-1">
              <div className="flex min-h-[24px] items-center justify-between gap-2 py-2">
                <p className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                  {t(section.labelKey)}
                </p>
                <span
                  className="num tabular shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
                  style={{ background: 'var(--surface-2)', color: pillColor(section.key, secPlan, secActual) }}
                  title={pillTitle(secPlan, secActual)}
                >
                  {pillText(secPlan, secActual)}
                </span>
              </div>
              {buildGroups(cats).map((g) => {
                if (g.root === null)
                  return renderLeafRow(section.key, g.cats[0], { border: true, sub: false })
                const gKey = `${section.key}|${g.root}`
                return (
                  <div key={gKey}>
                    {renderGroupHeader(section.key, g.root, g.cats, { border: true })}
                    {expanded.has(gKey) &&
                      g.cats.map((cat) => renderLeafRow(section.key, cat, { border: true, sub: true }))}
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>

      {/* Toggle floating "Rencana | Sisa" ala Budget — pill gelap (samain dock,
          warna hardcoded bukan token) fixed di atas dock; md+ ke-hide bareng
          wrapper mobile halaman */}
      <div
        className="fixed inset-x-0 z-30 flex justify-center md:hidden pointer-events-none"
        style={{ bottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      >
        <div
          className="pointer-events-auto flex items-center rounded-full p-1"
          style={{
            background: 'rgba(244,244,246,0.92)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 6px 20px rgba(0,0,0,.12)',
          }}
        >
          {(['plan', 'remain'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className="rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors"
              style={
                view === v
                  ? { background: 'transparent', color: 'var(--c-teal-ink, #2a9d8f)', fontWeight: 600 }
                  : { color: 'var(--ink-soft)' }
              }
            >
              {v === 'plan' ? t('budgeting.mode_plan') : t('mobile_budget.remaining')}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
