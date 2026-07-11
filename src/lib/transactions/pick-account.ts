/**
 * Smart default akun untuk form transaksi (4 lapis prioritas) — logika murni,
 * diekstrak dari transactions/page.tsx (protokol pecah god-file, langkah A).
 *
 * Lapis: (1) deteksi AI dari struk (nama akun / metode kredit / cash),
 * (2) default tersimpan user, (3) terakhir dipakai, (4) fallback akun cash
 * lalu akun pertama.
 */

export type PickSource = 'ai' | 'default' | 'last_used' | 'first'
export type ExtractedPayment = { payment_method?: string; payment_detail?: string }

export type PickInputs = {
  accounts: readonly { id: string; name: string; type?: string }[]
  creditCards: readonly { id: string; name: string }[]
  defaultAccountId?: string | null
  /** account_id transaksi terbaru yang punya akun (lapis last-used). */
  lastUsedAccountId?: string | null
  extracted?: ExtractedPayment
}

export function pickAccount(inputs: PickInputs): { id: string; source: PickSource } | null {
  const { accounts, creditCards, defaultAccountId, lastUsedAccountId, extracted } = inputs
  if (accounts.length === 0 && creditCards.length === 0) return null
  const allAccounts = [
    ...accounts.map((a) => ({ id: a.id, name: a.name })),
    ...creditCards.map((c) => ({ id: c.id, name: `Kredit ${c.name}` })),
  ]

  // Layer 1: AI-detected payment match
  const detail = extracted?.payment_detail?.trim().toLowerCase()
  if (detail && detail.length > 1) {
    const match = allAccounts.find((a) => {
      const n = a.name.toLowerCase()
      return n.includes(detail) || detail.includes(n)
    })
    if (match) return { id: match.id, source: 'ai' }
  }
  // Also try matching credit_card method to any credit card in list
  if (extracted?.payment_method === 'credit_card' && creditCards.length > 0) {
    return { id: creditCards[0].id, source: 'ai' }
  }
  // Cash payment method → match any cash-type account
  if (extracted?.payment_method === 'cash') {
    const cashAcc = accounts.find((a) => a.type === 'cash')
    if (cashAcc) return { id: cashAcc.id, source: 'ai' }
  }

  // Layer 2: User's saved default
  if (defaultAccountId && allAccounts.some((a) => a.id === defaultAccountId)) {
    return { id: defaultAccountId, source: 'default' }
  }

  // Layer 3: Last used (from most recent transaction)
  if (lastUsedAccountId && allAccounts.some((a) => a.id === lastUsedAccountId)) {
    return { id: lastUsedAccountId, source: 'last_used' }
  }

  // Layer 4: Fallback — prefer cash-type account, else first in list.
  // Most ID transactions are cash; this gives a sensible default for users
  // who haven't explicitly set one yet.
  const cashFallback = accounts.find((a) => a.type === 'cash')
  if (cashFallback) return { id: cashFallback.id, source: 'first' }
  return { id: allAccounts[0].id, source: 'first' }
}
