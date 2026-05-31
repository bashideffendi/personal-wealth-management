import { redirect } from 'next/navigation'

// Halaman Subscription dilebur ke Kontrak → "Langganan & Kontrak" (1 Jun 2026).
// Kontrak udah punya kategori "Langganan" + tracking renewal/reminder, jadi
// halaman terpisah ini redundant (subscriptions = view filter recurring_transactions).
// Redirect biar bookmark / link lama tetep nyampe ke tempat baru.
export default function SubscriptionsPage() {
  redirect('/dashboard/contracts')
}
