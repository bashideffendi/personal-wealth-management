'use client'

/**
 * Save More Tomorrow — Thaler-Benartzi (2004) commitment device.
 *
 * Original SMT raised 401(k) participation US dari 49% → 86% via:
 *   1. Pre-commitment di awal (sebelum gaji naik = sebelum loss aversion kena)
 *   2. Auto-increment savings rate setiap raise atau periodic
 *   3. Default opt-in (status quo bias bekerja untuk user, bukan against)
 *
 * Versi PWM v1: tracker komitmen sederhana — user set target final
 * savings rate, app reminder untuk naikkan kontribusi setiap quarter.
 * Belum ada auto-debit (butuh integrasi banking), tapi commitment +
 * reminder sudah powerful secara behavioral.
 *
 * State persisted di localStorage (per device, by design).
 */

import { useEffect, useState } from 'react'
import { TrendingUp, Sparkles, Check } from 'lucide-react'
import { EduTip } from '@/components/edu/edu-tip'

const STORAGE_KEY = 'pwm.save-more-tomorrow'

interface Commitment {
  enabled: boolean
  startRate: number       // % savings rate when committed
  targetRate: number      // target final %
  incrementPct: number    // how much to add per period (default 1)
  intervalMonths: number  // how often to increment (default 3 months)
  startedAt: string       // ISO date
  lastBumpedAt: string    // ISO date
}

const DEFAULT_COMMITMENT: Commitment = {
  enabled: false,
  startRate: 10,
  targetRate: 25,
  incrementPct: 1,
  intervalMonths: 3,
  startedAt: '',
  lastBumpedAt: '',
}

interface Props {
  /** Current actual savings rate (% of income) — for comparison vs commitment */
  currentRate: number
}

function loadCommitment(): Commitment {
  if (typeof window === 'undefined') return DEFAULT_COMMITMENT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_COMMITMENT
    return { ...DEFAULT_COMMITMENT, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_COMMITMENT
  }
}

function saveCommitment(c: Commitment) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
}

function monthsBetween(a: string, b: string): number {
  if (!a || !b) return 0
  const da = new Date(a)
  const db = new Date(b)
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth())
}

export function SaveMoreTomorrow({ currentRate }: Props) {
  const [c, setC] = useState<Commitment>(DEFAULT_COMMITMENT)
  const [showSetup, setShowSetup] = useState(false)
  const [setupTarget, setSetupTarget] = useState(25)

  useEffect(() => {
    setC(loadCommitment())
  }, [])

  function activate() {
    const now = new Date().toISOString()
    const next: Commitment = {
      enabled: true,
      startRate: Math.max(0, Math.round(currentRate)),
      targetRate: setupTarget,
      incrementPct: 1,
      intervalMonths: 3,
      startedAt: now,
      lastBumpedAt: now,
    }
    setC(next)
    saveCommitment(next)
    setShowSetup(false)
  }

  function bump() {
    const next = {
      ...c,
      lastBumpedAt: new Date().toISOString(),
    }
    setC(next)
    saveCommitment(next)
  }

  function disable() {
    const next = { ...c, enabled: false }
    setC(next)
    saveCommitment(next)
  }

  // Compute: where should user be NOW based on commitment schedule?
  const expectedRate = (() => {
    if (!c.enabled || !c.startedAt) return c.startRate
    const monthsSinceStart = monthsBetween(c.startedAt, new Date().toISOString())
    const incrementsDone = Math.floor(monthsSinceStart / c.intervalMonths)
    return Math.min(c.targetRate, c.startRate + incrementsDone * c.incrementPct)
  })()

  const monthsSinceLastBump = monthsBetween(c.lastBumpedAt, new Date().toISOString())
  const dueForBump = c.enabled && monthsSinceLastBump >= c.intervalMonths && expectedRate < c.targetRate
  const onTrack = c.enabled && currentRate >= expectedRate

  // ─── Disabled / setup state ────────────────────────────
  if (!c.enabled) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div
            className="size-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.10)' }}
          >
            <TrendingUp className="size-4" style={{ color: '#6366F1' }} />
          </div>
          <div className="flex-1">
            <p className="caps flex items-center gap-1.5">
              Save More Tomorrow
              <EduTip topic="save-more-tomorrow" side="bottom" />
            </p>
            <h3 className="font-display text-base mt-0.5" style={{ color: 'var(--ink)' }}>
              Komitmen naik kontribusi pelan-pelan
            </h3>
          </div>
        </div>

        <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--ink-muted)' }}>
          Mulai dari savings rate sekarang ({currentRate.toFixed(0)}%), naikkan +1% setiap 3 bulan
          sampai target tercapai. Aksi kecil per kuartal, gabung jadi besar dalam 2-3 tahun.
        </p>

        {!showSetup ? (
          <button
            type="button"
            onClick={() => setShowSetup(true)}
            className="w-full px-4 py-2 rounded-md text-sm font-semibold transition"
            style={{
              background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
              color: '#FFFFFF',
            }}
          >
            Mulai Komitmen
          </button>
        ) : (
          <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--ink-soft)' }}>
                Target final savings rate (saat ini {currentRate.toFixed(0)}%)
              </p>
              <input
                type="range"
                min={Math.max(10, Math.ceil(currentRate))}
                max={50}
                step={5}
                value={setupTarget}
                onChange={(e) => setSetupTarget(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                  Sekarang: {Math.round(currentRate)}%
                </span>
                <span
                  className="text-lg font-bold num tabular"
                  style={{ color: '#6366F1' }}
                >
                  {setupTarget}%
                </span>
                <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                  Max: 50%
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={activate}
              className="w-full px-4 py-2 rounded-md text-sm font-semibold transition"
              style={{
                background: 'var(--ink)',
                color: 'var(--surface)',
              }}
            >
              Aktifkan ({currentRate.toFixed(0)}% → {setupTarget}%)
            </button>
            <button
              type="button"
              onClick={() => setShowSetup(false)}
              className="w-full text-xs underline opacity-50 hover:opacity-100"
              style={{ color: 'var(--ink-muted)' }}
            >
              Batal
            </button>
          </div>
        )}
      </div>
    )
  }

  // ─── Active commitment state ─────────────────────────
  const progress = ((expectedRate - c.startRate) / (c.targetRate - c.startRate)) * 100

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: dueForBump
          ? 'linear-gradient(135deg, rgba(99,102,241,0.06), var(--surface) 50%)'
          : 'var(--surface)',
        borderColor: dueForBump ? 'rgba(99,102,241,0.20)' : 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div
            className="size-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.10)' }}
          >
            <Sparkles className="size-4" style={{ color: '#6366F1' }} />
          </div>
          <div>
            <p className="caps flex items-center gap-1.5">
              Save More Tomorrow
              <EduTip topic="save-more-tomorrow" side="bottom" />
            </p>
            <h3 className="font-display text-base mt-0.5" style={{ color: 'var(--ink)' }}>
              Komitmen Aktif
            </h3>
          </div>
        </div>
        {onTrack && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(16,185,129,0.10)', color: '#059669' }}
          >
            <Check className="size-2.5" />
            On track
          </span>
        )}
      </div>

      {/* Progress display */}
      <div className="grid grid-cols-3 gap-3 mb-3 text-[11px]">
        <div>
          <p style={{ color: 'var(--ink-soft)' }}>Mulai</p>
          <p className="num font-bold mt-0.5" style={{ color: 'var(--ink)' }}>
            {c.startRate}%
          </p>
        </div>
        <div>
          <p style={{ color: 'var(--ink-soft)' }}>Target Sekarang</p>
          <p className="num font-bold mt-0.5" style={{ color: '#6366F1' }}>
            {expectedRate}%
          </p>
        </div>
        <div>
          <p style={{ color: 'var(--ink-soft)' }}>Target Final</p>
          <p className="num font-bold mt-0.5" style={{ color: 'var(--ink)' }}>
            {c.targetRate}%
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, progress)}%`,
            background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
          }}
        />
      </div>

      {/* Status message */}
      <p className="text-[12px] mt-3 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
        Aktual saat ini: <span className="num font-semibold" style={{ color: 'var(--ink)' }}>
          {currentRate.toFixed(1)}%
        </span> dari pendapatan.
        {!onTrack && c.enabled && (
          <span style={{ color: '#F59E0B' }}>
            {' '}Coba naikan kontribusi sedikit untuk kejar komitmen ({expectedRate}%).
          </span>
        )}
      </p>

      {dueForBump && (
        <button
          type="button"
          onClick={bump}
          className="mt-3 w-full px-3 py-2 rounded-md text-xs font-semibold transition"
          style={{
            background: 'rgba(99,102,241,0.08)',
            color: '#6366F1',
            border: '1px solid rgba(99,102,241,0.25)',
          }}
        >
          Mark as bumped (naik +{c.incrementPct}%)
        </button>
      )}

      <button
        type="button"
        onClick={disable}
        className="mt-3 text-[10px] underline opacity-40 hover:opacity-100"
        style={{ color: 'var(--ink-muted)' }}
      >
        Hentikan komitmen
      </button>
    </div>
  )
}
