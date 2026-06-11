import { redirect } from 'next/navigation'

/**
 * /debts/strategy DIHAPUS (audit 2026-06-11): halaman orphan (tidak di-link
 * dari mana pun) sekaligus duplikat inferior — halaman utama /debts punya
 * simulasi payoff beneran (simulatePayoff: bunga, urutan, timeline, what-if
 * cicilan ekstra), sedangkan halaman ini cuma sort naif + input ekstra yang
 * tidak menghitung apa pun, dengan desain era pra-token. Redirect dipertahankan
 * untuk bookmark/riwayat lama.
 */
export default function DebtStrategyRedirect() {
  redirect('/dashboard/debts')
}
