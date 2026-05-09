/**
 * IDX broker catalog with standard buy/sell fee rates.
 *
 * Codes are the official 2-character broker codes used in IDX's broker
 * summary and order book (e.g. CC = Mandiri Sekuritas, BS = BCA Sekuritas).
 *
 * Fee rates are the *typical* discount-broker rates as of 2025/26 — actual
 * rates vary by broker tier, account type, and may include negotiated
 * fee waivers. The user can override on a per-transaction basis. We chose
 * defaults that match what most retail investors actually pay through
 * the broker's online app.
 *
 * Pattern: most brokers charge buy = base rate + 0.04% sales tax-adjacent;
 * sell rate adds 0.10% withholding tax (PPh) → so sell ≈ buy + 0.10%.
 */

export interface IdxBroker {
  /** 2-char IDX broker code, used in order book display */
  code: string
  /** Full registered name */
  name: string
  /** Short name for UI */
  short: string
  /** Buy commission rate (e.g. 0.0017 = 0.17%) */
  buyRate: number
  /** Sell commission rate (includes withholding tax) */
  sellRate: number
  /** Loose category for grouping */
  tier: 'discount' | 'fullService' | 'bank'
}

export const IDX_BROKERS: IdxBroker[] = [
  // ─── Discount / digital-first (lowest fees) ────────────────
  { code: 'XL', name: 'Stockbit Sekuritas Digital', short: 'Stockbit',         buyRate: 0.0010, sellRate: 0.0020, tier: 'discount' },
  { code: 'PG', name: 'Ajaib Sekuritas Asia',       short: 'Ajaib',            buyRate: 0.0010, sellRate: 0.0020, tier: 'discount' },
  { code: 'PD', name: 'Indo Premier Sekuritas',     short: 'IPOT (Indo Premier)', buyRate: 0.0019, sellRate: 0.0029, tier: 'discount' },
  { code: 'XA', name: 'Reliance Sekuritas',         short: 'Reliance',         buyRate: 0.0017, sellRate: 0.0027, tier: 'discount' },

  // ─── Bank-affiliated ──────────────────────────────────────
  { code: 'BS', name: 'BCA Sekuritas',                       short: 'BCA Sekuritas',   buyRate: 0.0018, sellRate: 0.0028, tier: 'bank' },
  { code: 'NI', name: 'BNI Sekuritas',                       short: 'BNI Sekuritas',   buyRate: 0.0017, sellRate: 0.0027, tier: 'bank' },
  { code: 'OD', name: 'BRI Danareksa Sekuritas',             short: 'BRI Danareksa',   buyRate: 0.0017, sellRate: 0.0027, tier: 'bank' },
  { code: 'CC', name: 'Mandiri Sekuritas',                   short: 'Mandiri Sekuritas', buyRate: 0.0018, sellRate: 0.0028, tier: 'bank' },
  { code: 'AK', name: 'UBS Sekuritas Indonesia',             short: 'UBS',             buyRate: 0.0025, sellRate: 0.0035, tier: 'fullService' },
  { code: 'NX', name: 'CIMB Niaga Sekuritas',                short: 'CIMB Niaga',      buyRate: 0.0019, sellRate: 0.0029, tier: 'bank' },

  // ─── Major full-service ───────────────────────────────────
  { code: 'YP', name: 'Mirae Asset Sekuritas Indonesia',     short: 'Mirae Asset',     buyRate: 0.0015, sellRate: 0.0025, tier: 'fullService' },
  { code: 'KK', name: 'Phillip Sekuritas Indonesia',         short: 'Phillip',         buyRate: 0.0018, sellRate: 0.0028, tier: 'fullService' },
  { code: 'LG', name: 'Trimegah Sekuritas Indonesia',        short: 'Trimegah',        buyRate: 0.0018, sellRate: 0.0028, tier: 'fullService' },
  { code: 'ZP', name: 'Maybank Sekuritas Indonesia',         short: 'Maybank Sekuritas', buyRate: 0.0019, sellRate: 0.0029, tier: 'fullService' },
  { code: 'YU', name: 'CGS International Sekuritas Indonesia', short: 'CGS International', buyRate: 0.0019, sellRate: 0.0029, tier: 'fullService' },
  { code: 'CG', name: 'Citigroup Sekuritas Indonesia',       short: 'Citi',            buyRate: 0.0025, sellRate: 0.0035, tier: 'fullService' },
  { code: 'DR', name: 'OCBC Sekuritas Indonesia',            short: 'OCBC Sekuritas',  buyRate: 0.0019, sellRate: 0.0029, tier: 'fullService' },
  { code: 'CP', name: 'Valbury Sekuritas Indonesia',         short: 'Valbury',         buyRate: 0.0018, sellRate: 0.0028, tier: 'fullService' },
  { code: 'SS', name: 'Sucor Sekuritas',                     short: 'Sucor',           buyRate: 0.0018, sellRate: 0.0028, tier: 'fullService' },
  { code: 'EP', name: 'MNC Sekuritas',                       short: 'MNC Sekuritas',   buyRate: 0.0018, sellRate: 0.0028, tier: 'discount' },
  { code: 'AT', name: 'Phintraco Sekuritas',                 short: 'Phintraco',       buyRate: 0.0018, sellRate: 0.0028, tier: 'fullService' },
  { code: 'AZ', name: 'Sinarmas Sekuritas',                  short: 'Sinarmas',        buyRate: 0.0019, sellRate: 0.0029, tier: 'fullService' },
  { code: 'AG', name: 'Kiwoom Sekuritas Indonesia',          short: 'Kiwoom',          buyRate: 0.0015, sellRate: 0.0025, tier: 'discount' },
  { code: 'YJ', name: 'Lotus Andalan Sekuritas',             short: 'Lotus Andalan',   buyRate: 0.0018, sellRate: 0.0028, tier: 'fullService' },
  { code: 'BR', name: 'Binaartha Sekuritas',                 short: 'Binaartha',       buyRate: 0.0018, sellRate: 0.0028, tier: 'fullService' },

  // ─── Other / "Tunai" placeholder ──────────────────────────
  { code: '', name: 'Tunai / Lainnya', short: 'Tunai / Lainnya', buyRate: 0, sellRate: 0, tier: 'discount' },
]

// Lookup helpers
export function getBrokerByName(name: string | null | undefined): IdxBroker | undefined {
  if (!name) return undefined
  const trimmed = name.trim()
  return IDX_BROKERS.find(
    (b) => b.name === trimmed || b.short === trimmed || `${b.short} (${b.code})` === trimmed,
  )
}

export function getBrokerByCode(code: string | null | undefined): IdxBroker | undefined {
  if (!code) return undefined
  return IDX_BROKERS.find((b) => b.code === code.toUpperCase())
}

/**
 * Compute the all-in fee for a transaction:
 *   transactionValue × (broker rate)
 * Returns null if broker unknown.
 */
export function computeFee(
  brokerCode: string | null | undefined,
  side: 'buy' | 'sell',
  transactionValue: number,
): number | null {
  const broker = getBrokerByCode(brokerCode)
  if (!broker) return null
  const rate = side === 'buy' ? broker.buyRate : broker.sellRate
  return Math.round(transactionValue * rate)
}
