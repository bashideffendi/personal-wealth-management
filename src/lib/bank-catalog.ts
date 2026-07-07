/**
 * Katalog ringan institusi keuangan Indonesia — dipakai langkah
 * "pilih institusi" di dialog tambah akun (versi ringan dari picker
 * bank ala app Budget: search + list berlogo, tanpa index A-Z).
 *
 * SELARAS dengan src/lib/indonesian-institutions.ts (sumber logo):
 *   - `logoBrand` (default = `name`) nunjuk ke `brand` di katalog itu,
 *     jadi InstitutionLogo bisa reuse logo ticker IDX yang sudah ada
 *     di /public/stock-logos.
 *   - `color` = warna brand (hex) buat avatar inisial fallback di picker
 *     kalau institusi belum punya aset logo (e-wallet, sekuritas, bank
 *     non-listed). indonesian-institutions TIDAK punya warna per brand
 *     (cuma gradient generik by-type di InstitutionLogo), jadi hex di
 *     sini nggak bentrok dengan apa pun.
 */

import {
  getInstitutionByBrand,
  type FinancialInstitution,
} from './indonesian-institutions'

export type BankCatalogType = 'bank' | 'digital_wallet' | 'rdn'

export interface BankCatalogItem {
  /** Nama yang di-auto-isi ke field nama akun (juga label di picker) */
  name: string
  /** Grup katalog — sekaligus jadi accounts.type saat dipilih */
  type: BankCatalogType
  /** Warna brand (hex) buat lingkaran inisial fallback */
  color: string
  /** Brand key di INDONESIAN_INSTITUTIONS kalau beda dari `name` */
  logoBrand?: string
}

export const BANK_CATALOG: BankCatalogItem[] = [
  // ─── Bank ─────────────────────────────────────────────────
  { name: 'BCA',            type: 'bank', color: '#0060AF' },
  { name: 'BNI',            type: 'bank', color: '#F15A22' },
  { name: 'BRI',            type: 'bank', color: '#00529C' },
  { name: 'Mandiri',        type: 'bank', color: '#003A70' },
  { name: 'BSI',            type: 'bank', color: '#00A39D' },
  { name: 'CIMB Niaga',     type: 'bank', color: '#7B1113' },
  { name: 'Danamon',        type: 'bank', color: '#F47920' },
  { name: 'Permata',        type: 'bank', color: '#00A651' },
  { name: 'BTN',            type: 'bank', color: '#1C3775' },
  { name: 'Jago',           type: 'bank', color: '#F7941D' },
  { name: 'Jenius',         type: 'bank', color: '#00A9CE' },   // BTPN digital
  { name: 'Bank Mega',      type: 'bank', color: '#EE7623', logoBrand: 'Mega' },
  { name: 'OCBC NISP',      type: 'bank', color: '#ED1B2E' },
  { name: 'Panin',          type: 'bank', color: '#0072BC' },
  { name: 'Maybank',        type: 'bank', color: '#E6A817' },
  { name: 'Sinarmas',       type: 'bank', color: '#DA251D' },
  { name: 'Bank DKI',       type: 'bank', color: '#D2232A' },   // non-listed, tanpa aset logo

  // ─── E-Wallet ─────────────────────────────────────────────
  { name: 'GoPay',     type: 'digital_wallet', color: '#00AED6' },
  { name: 'OVO',       type: 'digital_wallet', color: '#4C3494' },
  { name: 'DANA',      type: 'digital_wallet', color: '#108EE9' },
  { name: 'ShopeePay', type: 'digital_wallet', color: '#EE4D2D' },
  { name: 'LinkAja',   type: 'digital_wallet', color: '#E82529' },
  { name: 'Sakuku',    type: 'digital_wallet', color: '#00A3E0' },  // e-wallet BCA

  // ─── RDN / Sekuritas ──────────────────────────────────────
  { name: 'Stockbit',          type: 'rdn', color: '#00AB6B' },  // RDN BCA
  { name: 'Mandiri Sekuritas', type: 'rdn', color: '#003A70' },
  { name: 'IPOT',              type: 'rdn', color: '#E31E24' },  // Indo Premier
  { name: 'Ajaib',             type: 'rdn', color: '#5D5FEF' },
  { name: 'Bibit',             type: 'rdn', color: '#35B34A' },
]

/**
 * Resolve item katalog ke entri indonesian-institutions (kalau ada) —
 * dipakai buat reuse logo IDX via InstitutionLogo.
 */
export function catalogInstitution(item: BankCatalogItem): FinancialInstitution | undefined {
  return getInstitutionByBrand(item.logoBrand ?? item.name)
}

/**
 * Filter katalog: query aktif → cari lintas grup (biar nggak buntu di
 * grup yang salah); query kosong → isi grup terpilih.
 */
export function filterCatalog(query: string, group: BankCatalogType): BankCatalogItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return BANK_CATALOG.filter((i) => i.type === group)
  return BANK_CATALOG.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      (i.logoBrand ?? '').toLowerCase().includes(q),
  )
}
