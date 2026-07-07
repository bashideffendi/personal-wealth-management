/**
 * Helper categorization_rules — dipakai server (import-mutasi) & client (import page).
 *
 * Skema (007_rules_stock_tx.sql): match_text, type, category, priority, is_active.
 * Matching konsisten dengan applyRules di transactions page: case-insensitive
 * substring (description CONTAINS match_text), priority tertinggi menang.
 */

export interface MatchableRule {
  match_text: string
  type: 'income' | 'expense' | 'saving' | 'investment'
  category: string
  priority: number
}

const MIN_PATTERN_LEN = 3
const MAX_PATTERN_LEN = 60

/**
 * Normalisasi description → pattern rule: lowercase, trim, collapse spasi,
 * buang angka/tanggal/kode-referensi TRAILING (bukan angka di tengah, biar
 * "kfc box 2" tetap kebedain dari "kfc"). Return '' kalau kependekan/gak layak.
 */
export function normalizeRulePattern(description: string): string {
  let s = description.toLowerCase().replace(/\s+/g, ' ').trim()
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s
      // separator/punctuation trailing
      .replace(/[\s\-–—:*#.,/|()]+$/, '')
      // tanggal trailing: 01/02/2026, 2026-02-01, 1-2-26, dst
      .replace(/\d{1,4}[-/.]\d{1,2}([-/.]\d{1,4})?$/, '')
      // blok angka trailing (no ref, batch, nominal)
      .replace(/\d+$/, '')
      .trim()
  }
  s = s.slice(0, MAX_PATTERN_LEN).trim()
  return s.length >= MIN_PATTERN_LEN ? s : ''
}

/**
 * Cari rule yang match description. Priority desc; substring case-insensitive.
 * Caller yang filter is_active (query .eq('is_active', true)).
 */
export function matchCategorizationRule<T extends MatchableRule>(
  description: string,
  rules: T[],
): T | null {
  const text = description.toUpperCase()
  const sorted = [...rules]
    .filter((r) => r.match_text.trim().length >= 2)
    .sort((a, b) => b.priority - a.priority)
  for (const r of sorted) {
    if (text.includes(r.match_text.trim().toUpperCase())) return r
  }
  return null
}
