/**
 * Katalog provider langganan/tagihan populer (global + Indonesia) — F13f.
 * TANPA logo image: avatar = lingkaran `color` + inisial putih.
 * Warna bergilir dari 4 keluarga brand Klunting.
 */

export type SubscriptionProvider = {
  name: string
  category: 'Langganan' | 'Tagihan' | 'Cicilan'
  color: string
}

const FAMILY = ['#17b890', '#f0664f', '#5d6fe0', '#8b4fb0'] as const

const RAW: [string, SubscriptionProvider['category']][] = [
  // Streaming & hiburan
  ['Netflix', 'Langganan'],
  ['Spotify', 'Langganan'],
  ['Disney+ Hotstar', 'Langganan'],
  ['Vidio', 'Langganan'],
  ['WeTV', 'Langganan'],
  ['iQIYI', 'Langganan'],
  ['Viu', 'Langganan'],
  ['YouTube Premium', 'Langganan'],
  // Ekosistem & cloud
  ['Apple One', 'Langganan'],
  ['iCloud+', 'Langganan'],
  ['Google One', 'Langganan'],
  // AI
  ['ChatGPT Plus', 'Langganan'],
  ['Claude Pro', 'Langganan'],
  ['Gemini Advanced', 'Langganan'],
  // Produktivitas & kreatif
  ['Canva', 'Langganan'],
  ['CapCut Pro', 'Langganan'],
  ['Adobe CC', 'Langganan'],
  ['Microsoft 365', 'Langganan'],
  // Gaming
  ['GamePass', 'Langganan'],
  ['PS Plus', 'Langganan'],
  ['Steam', 'Langganan'],
  ['Mobile Legends', 'Langganan'],
  // Internet rumah
  ['IndiHome', 'Tagihan'],
  ['First Media', 'Tagihan'],
  ['Biznet', 'Tagihan'],
  ['MyRepublic', 'Tagihan'],
  // Seluler
  ['Telkomsel', 'Tagihan'],
  ['XL', 'Tagihan'],
  ['Indosat', 'Tagihan'],
  ['by.U', 'Tagihan'],
  ['Smartfren', 'Tagihan'],
  // Utilitas & wajib
  ['PLN', 'Tagihan'],
  ['PDAM', 'Tagihan'],
  ['BPJS Kesehatan', 'Tagihan'],
  ['KPR', 'Cicilan'],
  ['Asuransi', 'Tagihan'],
]

export const SUBSCRIPTION_PROVIDERS: SubscriptionProvider[] = RAW.map(
  ([name, category], i) => ({ name, category, color: FAMILY[i % FAMILY.length] }),
)

/** 1–2 huruf inisial buat avatar (huruf/angka pertama dari maks 2 kata). */
export function providerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.match(/[A-Za-z0-9]/)?.[0] ?? w[0])
    .join('')
    .toUpperCase()
}
