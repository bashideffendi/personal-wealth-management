import { redirect } from 'next/navigation'

// Kartu kredit = utang revolving → sekarang dikelola sebagai section di bawah
// halaman Utang. Route lama di-redirect biar link/bookmark lama tetap jalan.
export default function CreditCardsRedirect() {
  redirect('/dashboard/debts#kartu-kredit')
}
