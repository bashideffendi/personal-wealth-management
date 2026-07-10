/**
 * Auto-kategorisasi transaksi dari categorization_rules — logika murni,
 * diekstrak dari transactions/page.tsx (protokol pecah god-file, langkah A).
 */

export type TxType = 'income' | 'expense' | 'saving' | 'investment'

export type RuleLike = {
  is_active: boolean
  priority: number
  match_text: string
  type: TxType
  category: string
}

/** Rule aktif prioritas tertinggi yang match_text-nya terkandung di deskripsi (case-insensitive). */
export function applyRules(
  rules: readonly RuleLike[],
  desc: string,
): { type: TxType; category: string } | null {
  const text = desc.toUpperCase()
  const sorted = [...rules].filter((r) => r.is_active).sort((a, b) => b.priority - a.priority)
  for (const r of sorted) {
    if (text.includes(r.match_text.toUpperCase())) {
      return { type: r.type, category: r.category }
    }
  }
  return null
}
