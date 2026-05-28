'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Debt } from '@/types'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import { Snowflake, TrendingDown, Target, Loader2, Zap, Flame, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { EduTip } from '@/components/edu/edu-tip'

export default function DebtStrategyPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [debts, setDebts] = useState<Debt[]>([])
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche'>('avalanche')
  const [extraPayment, setExtraPayment] = useState(0)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('debts').select('*').eq('user_id', user.id)
    setDebts((data ?? []) as Debt[])
    setLoading(false)
  }

  const active = useMemo(() => debts.filter((d) => d.is_active && d.remaining > 0), [debts])
  const ordered = useMemo(() =>
    [...active].sort((a, b) =>
      strategy === 'snowball' ? a.remaining - b.remaining : b.interest_rate - a.interest_rate,
    )
  , [active, strategy])
  const totalMin = active.reduce((s, d) => s + d.monthly_payment, 0)
  const totalMonthly = totalMin + extraPayment
  const totalRemaining = active.reduce((s, d) => s + d.remaining, 0)

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #0F1F1A 100%)',
          color: '#F5F5F7',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -100, right: -60, width: 360, height: 360,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.16), transparent 65%)',
          }}
        />
        <div className="relative p-6 sm:p-7">
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase"
            style={{ color: '#FCD34D' }}
          >
            Strategi Pelunasan
          </p>
          <h1
            className="font-bold tracking-tight mt-2 flex items-center gap-2"
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              color: '#FFFFFF',
              letterSpacing: '-0.035em',
            }}
          >
            Atur Prioritas Utang
            <EduTip topic="debt-strategy" side="bottom" iconSize={18} />
          </h1>
          <p className="text-sm mt-2 max-w-xl" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Pilih Snowball (saldo terkecil dulu) atau Avalanche (bunga tertinggi dulu). Tambahkan pembayaran
            ekstra untuk mempercepat lunas.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--c-mint)' }} /></div>
      ) : active.length === 0 ? (
        // Educational empty state — show users WHAT the feature does even
        // before they have debts. Bebas utang is great, but they should
        // know this tool exists for the day they take a KPR / paylater.
        <>
          <div
            className="rounded-xl border p-5 sm:p-6 flex items-start gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(14,165,233,0.05))',
              borderColor: 'var(--border-soft)',
            }}
          >
            <div
              className="hidden sm:flex shrink-0 size-12 items-center justify-center rounded-xl text-2xl"
              style={{ background: 'rgba(16,185,129,0.18)' }}
            >
              🎉
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
                Bebas utang — keren!
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
                Begitu ada utang baru (KPR, KKB, paylater, kartu kredit),
                tool ini ngitungin urutan bayar terbaik biar lunas lebih cepat & lebih hemat bunga.
              </p>
              <Link
                href="/dashboard/debts"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium"
                style={{ color: 'var(--emerald-600, #059669)' }}
              >
                Catat utang pertamamu
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Demo strategy comparison — always visible so users learn */}
          <div className="grid gap-4 sm:grid-cols-2">
            <StrategyCard
              active={false}
              onClick={() => {}}
              emoji="❄️"
              icon={<Snowflake className="h-4 w-4" />}
              title="Snowball"
              subtitle="Saldo Terkecil Dulu"
              desc="Lunasi utang dengan saldo terkecil dulu — momentum cepat, bagus buat motivasi disiplin."
              accent="linear-gradient(135deg, #06B6D4, #3B82F6)"
            />
            <StrategyCard
              active={false}
              onClick={() => {}}
              emoji="🔥"
              icon={<TrendingDown className="h-4 w-4" />}
              title="Avalanche"
              subtitle="Bunga Tertinggi Dulu"
              desc="Lunasi utang dengan bunga tertinggi dulu — paling hemat secara matematika."
              accent="linear-gradient(135deg, #F43F5E, #F97316)"
            />
          </div>

          <div
            className="rounded-xl border p-4 text-sm"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border-soft)',
              color: 'var(--ink-muted)',
            }}
          >
            <p className="font-medium mb-1" style={{ color: 'var(--ink)' }}>Contoh kasus:</p>
            <p>
              Misal punya 3 utang: KPR Rp 250jt (bunga 8%), KKB Rp 80jt (bunga 11%), kartu kredit Rp 12jt (bunga 24%).
            </p>
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li><strong>Snowball</strong>: Kartu kredit dulu (paling kecil) → KKB → KPR. Cepat ada win pertama.</li>
              <li><strong>Avalanche</strong>: Kartu kredit dulu (bunga 24%) → KKB (11%) → KPR (8%). Hemat bunga ratusan juta.</li>
            </ul>
          </div>
        </>
      ) : (
        <>
          {/* Strategy picker */}
          <div className="grid gap-4 sm:grid-cols-2">
            <StrategyCard
              active={strategy === 'snowball'}
              onClick={() => setStrategy('snowball')}
              emoji="❄️"
              icon={<Snowflake className="h-4 w-4" />}
              title="Snowball"
              subtitle="Saldo Terkecil Dulu"
              desc="Cepat menang kecil. Bagus untuk motivasi & disiplin awal."
              accent="linear-gradient(135deg, #06B6D4, #3B82F6)"
            />
            <StrategyCard
              active={strategy === 'avalanche'}
              onClick={() => setStrategy('avalanche')}
              emoji="🔥"
              icon={<TrendingDown className="h-4 w-4" />}
              title="Avalanche"
              subtitle="Bunga Tertinggi Dulu"
              desc="Menghemat bunga. Paling optimal secara matematis."
              accent="linear-gradient(135deg, #F43F5E, #F97316)"
            />
          </div>

          {/* Extra payment */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: 'var(--c-mint)' }} />
              <Label htmlFor="extra" className="text-sm font-semibold">Pembayaran Ekstra per Bulan</Label>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
              Tambahan di luar cicilan minimum, otomatis dialokasikan ke utang prioritas.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="text-lg font-semibold" style={{ color: 'var(--ink-soft)' }}>Rp</div>
              <NumberInput
                id="extra"
                value={extraPayment}
                onChange={(n) => setExtraPayment(n)}
                placeholder="0"
                className="flex-1 text-lg"
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
              <Stat label="Total cicilan/bln" value={formatCurrency(totalMin)} />
              <Stat label="Ekstra" value={formatCurrency(extraPayment)} />
              <Stat label="Total out/bln" value={formatCurrency(totalMonthly)} highlight />
            </div>
          </div>

          {/* Ordered queue */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4" style={{ color: 'var(--danger)' }} />
              <h3 className="text-xl font-bold">Urutan Prioritas</h3>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--ink-soft)' }}>
              Sisa total {formatCurrency(totalRemaining)} · {active.length} utang
            </p>
            <div className="space-y-2.5">
              {ordered.map((d, i) => {
                const focus = i === 0
                return (
                  <div
                    key={d.id}
                    className={`relative overflow-hidden rounded-xl p-4 border flex items-center justify-between transition-all ${focus ? 'ring-2' : ''}`}
                    style={{
                      background: focus ? 'var(--c-mint-soft)' : 'var(--surface)',
                      borderColor: focus ? 'var(--c-mint)' : 'var(--border-soft)',
                    }}
                  >
                    {focus && (
                      <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: 'radial-gradient(circle at top right, rgba(16,185,129,0.18), transparent 60%)' }} />
                    )}
                    <div className="relative flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
                        style={{
                          background: focus ? 'var(--c-primary)' : 'var(--surface-alt)',
                          color: focus ? '#FFF' : 'var(--ink-muted)',
                        }}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{d.name}</p>
                          {focus && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'linear-gradient(135deg, #6366F1, #EC4899)', color: '#FFF' }}>
                              <Target className="h-2.5 w-2.5" /> Fokus
                            </span>
                          )}
                        </div>
                        <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                          {strategy === 'avalanche' ? `Bunga ${d.interest_rate}%` : `Sisa ${formatCurrency(d.remaining)}`}
                          {' · '}
                          Cicilan {formatCurrency(d.monthly_payment)}/bln
                        </p>
                      </div>
                    </div>
                    <div className="relative text-right">
                      <p className="text-sm font-semibold tabular" style={{ color: 'var(--ink)' }}>
                        {formatCurrency(d.remaining)}
                      </p>
                      <p className="text-[11px] tabular" style={{ color: 'var(--ink-soft)' }}>
                        {d.interest_rate}% p.a.
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StrategyCard({
  active, onClick, emoji, icon, title, subtitle, desc, accent,
}: {
  active: boolean
  onClick: () => void
  emoji: string
  icon: React.ReactNode
  title: string
  subtitle: string
  desc: string
  accent: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl p-5 text-left transition-all border ${active ? 'ring-2 shadow-lg' : 'hover:shadow-md hover:-translate-y-0.5'}`}
      style={{
        background: active ? accent : 'var(--surface)',
        borderColor: active ? 'transparent' : 'var(--border-soft)',
        color: active ? '#FFF' : 'var(--ink)',
      }}
    >
      {!active && (
        <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-20" style={{ background: accent }} />
      )}
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider opacity-80">{subtitle}</p>
          <h3 className={`mt-1 text-2xl font-bold tracking-tight ${!active ? '' : ''}`}>{emoji} {title}</h3>
          <p className={`text-sm mt-2 ${active ? 'opacity-85' : ''}`} style={!active ? { color: 'var(--ink-muted)' } : undefined}>
            {desc}
          </p>
        </div>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{
            background: active ? 'rgba(255,255,255,0.2)' : 'var(--surface-alt)',
            color: active ? '#FFF' : 'var(--ink-muted)',
          }}
        >
          {icon}
        </div>
      </div>
    </button>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl p-2.5 border"
      style={{
        background: highlight ? 'var(--c-mint)' : 'var(--surface)',
        borderColor: highlight ? 'var(--c-mint)' : 'var(--border-soft)',
      }}
    >
      <p className="eyebrow" style={{ fontSize: '0.625rem' }}>{label}</p>
      <p className="text-sm font-semibold tabular mt-0.5" style={{ color: highlight ? 'var(--c-mint)' : 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
