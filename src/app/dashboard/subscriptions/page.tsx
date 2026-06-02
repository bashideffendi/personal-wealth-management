import { redirect } from 'next/navigation'

// Subscription tetap DILEBUR ke "Kontrak & Polis" (keputusan user, 2026-06).
// Langganan digital dicatat sebagai contract kategori 'subscription'/'Langganan'.
// Route lama di-redirect biar bookmark/link lama tetap nyampe.
export default function SubscriptionsPage() {
  redirect('/dashboard/contracts')
}
