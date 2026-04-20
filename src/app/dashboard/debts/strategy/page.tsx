'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Debt } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Snowflake, TrendingDown, Target, Loader2, Zap, Flame } from 'lucide-react'

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
      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Strategi Pelunasan</p>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-2" style={{ color: 'var(--ink)' }}>
          Atur Prioritas Utang
        </h2>
        <p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--on-black-mut)' }}>
          Pilih Snowball (saldo terkecil dulu) atau Avalanche (bunga tertinggi dulu). Tambahkan pembayaran
          ekstra untuk mempercepat lunas.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--indigo-600)' }} /></div>
      ) : active.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-5xl">🎉</p>
          <p className="mt-3 font-semibold">Tidak ada utang aktif</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Selamat, Anda bebas utang!</p>
        </div>
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
              <Zap className="h-4 w-4" style={{ color: 'var(--indigo-600)' }} />
              <Label htmlFor="extra" className="text-sm font-semibold">Pembayaran Ekstra per Bulan</Label>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
              Tambahan di luar cicilan minimum, otomatis dialokasikan ke utang prioritas.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="text-lg font-semibold" style={{ color: 'var(--ink-soft)' }}>Rp</div>
              <Input
                id="extra"
                type="number"
                min={0}
                value={extraPayment || ''}
                onChange={(e) => setExtraPayment(Number(e.target.value) || 0)}
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
              <h3 className="font-display text-xl font-bold">Urutan Prioritas</h3>
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
                      background: focus ? 'var(--indigo-50)' : 'var(--surface)',
                      borderColor: focus ? 'var(--indigo-500)' : 'var(--border-soft)',
                    }}
                  >
                    {focus && (
                      <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: 'radial-gradient(circle at top right, rgba(99,102,241,0.15), transparent 60%)' }} />
                    )}
                    <div className="relative flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
                        style={{
                          background: focus ? 'linear-gradient(135deg, #6366F1, #EC4899)' : 'var(--surface-alt)',
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
          <h3 className={`font-display mt-1 text-2xl font-bold ${!active ? '' : ''}`}>{emoji} {title}</h3>
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
        background: highlight ? 'var(--indigo-50)' : 'var(--surface)',
        borderColor: highlight ? 'var(--indigo-200)' : 'var(--border-soft)',
      }}
    >
      <p className="caps" style={{ fontSize: '0.625rem' }}>{label}</p>
      <p className="text-sm font-semibold tabular mt-0.5" style={{ color: highlight ? 'var(--indigo-700)' : 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
