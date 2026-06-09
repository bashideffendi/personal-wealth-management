'use client'

/**
 * Reflective Spending Modal — Kakeibo (家計簿) anti-impulse nudge.
 *
 * Hani Motoko (Japan, 1904) created Kakeibo as a household financial
 * journaling method. Core idea: before any non-essential purchase, ask
 * 4 reflection questions. The pause itself is the intervention.
 *
 * In Klunting: trigger when user creates an expense transaction over a
 * threshold (default Rp 500k, configurable). Modal blocks save until
 * user reflects — they can either confirm or cancel the transaction.
 *
 * NOT used for income/saving/investment transactions — only expenses.
 *
 * User can disable via localStorage flag (don't be paternalistic).
 */

import { useState } from 'react'
import { Pause, Check, X as XIcon } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  /** Called when user confirms — caller proceeds with the actual save */
  onConfirm: () => void
  /** Transaction context for display */
  amount: number
  category: string
  description: string
}

const QUESTIONS = [
  { key: 'need',  text: 'Apakah saya benar-benar PERLU?' },
  { key: 'afford', text: 'Apakah saya mampu (tanpa pinjam/cicilan)?' },
  { key: 'use',    text: 'Akan saya gunakan secara konsisten?' },
  { key: 'happy',  text: 'Apakah ini bikin saya bahagia jangka panjang?' },
] as const

const STORAGE_KEY = 'pwm.reflective-spending.disabled'

export function ReflectiveSpendingModal({
  open, onClose, onConfirm, amount, category, description,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({
    need: null, afford: null, use: null, happy: null,
  })

  function answer(key: string, value: boolean) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  function reset() {
    setAnswers({ need: null, afford: null, use: null, happy: null })
  }

  function handleConfirm() {
    onConfirm()
    reset()
    onClose()
  }

  function handleCancel() {
    reset()
    onClose()
  }

  function handleDisable() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    handleConfirm()
  }

  // Count yes answers
  const yesCount = Object.values(answers).filter((v) => v === true).length
  const noCount = Object.values(answers).filter((v) => v === false).length
  const allAnswered = yesCount + noCount === QUESTIONS.length

  // Verdict
  const verdict = (() => {
    if (!allAnswered) return null
    if (yesCount >= 3) return { tone: 'good', text: 'Boleh lanjut — keputusan terinformasi.' }
    if (yesCount >= 2) return { tone: 'caution', text: 'Pertimbangkan lagi — ada keraguan.' }
    return { tone: 'warning', text: 'Mungkin tunda dulu — banyak red flag.' }
  })()

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="size-9 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--c-amber-soft)' }}
            >
              <Pause className="size-4" style={{ color: 'var(--c-amber)' }} />
            </div>
            <div>
              <p className="eyebrow">Kakeibo Reflection</p>
              <DialogTitle className="text-base mt-0.5">Berhenti sejenak…</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Transaction summary */}
        <div
          className="rounded-lg p-3 text-sm"
          style={{ background: 'var(--surface-2)' }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span style={{ color: 'var(--ink)' }}>
              {description || category}
            </span>
            <span className="num font-bold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(amount)}
            </span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>
            {category}
          </p>
        </div>

        {/* Questions */}
        <div className="space-y-2.5 mt-2">
          {QUESTIONS.map((q) => {
            const ans = answers[q.key]
            return (
              <div
                key={q.key}
                className="flex items-center justify-between gap-3 rounded-lg p-2.5 border"
                style={{
                  borderColor: ans === null ? 'var(--border-soft)' : 'var(--border)',
                  background: ans === null ? 'var(--surface)' : 'var(--surface-2)',
                }}
              >
                <p className="text-[13px] flex-1" style={{ color: 'var(--ink)' }}>
                  {q.text}
                </p>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => answer(q.key, true)}
                    className="size-7 rounded flex items-center justify-center transition"
                    style={{
                      background: ans === true ? '#10B981' : 'var(--surface-2)',
                      color: ans === true ? '#FFFFFF' : 'var(--ink-soft)',
                    }}
                    aria-label="Ya"
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => answer(q.key, false)}
                    className="size-7 rounded flex items-center justify-center transition"
                    style={{
                      background: ans === false ? '#F43F5E' : 'var(--surface-2)',
                      color: ans === false ? '#FFFFFF' : 'var(--ink-soft)',
                    }}
                    aria-label="Tidak"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Verdict */}
        {verdict && (
          <div
            className="rounded-lg p-3 mt-2 text-sm"
            style={{
              background: verdict.tone === 'good' ? 'rgba(16,185,129,0.08)'
                : verdict.tone === 'caution' ? 'rgba(245,158,11,0.10)'
                : 'rgba(244,63,94,0.08)',
              color: verdict.tone === 'good' ? 'var(--c-mint)'
                : verdict.tone === 'caution' ? 'var(--amber-700)'
                : 'var(--c-coral)',
            }}
          >
            <span className="font-semibold">{yesCount}/4 ya</span> · {verdict.text}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <button
            type="button"
            onClick={handleDisable}
            className="text-[11px] underline opacity-50 hover:opacity-100 mr-auto"
            style={{ color: 'var(--ink-muted)' }}
          >
            Matikan reflection
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-md text-sm font-medium transition"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--ink)',
            }}
          >
            Tunda
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!allAnswered}
            className="px-4 py-2 rounded-md text-sm font-semibold transition disabled:opacity-50"
            style={{
              background: 'var(--ink)',
              color: 'var(--surface)',
            }}
          >
            Tetap Lanjut
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Helper: should we trigger the modal for this transaction? */
export function shouldTriggerReflection(params: {
  type: string
  amount: number
  threshold?: number
}): boolean {
  if (typeof window === 'undefined') return false
  if (localStorage.getItem(STORAGE_KEY) === 'true') return false
  if (params.type !== 'expense') return false
  const threshold = params.threshold ?? 500_000
  return params.amount >= threshold
}
