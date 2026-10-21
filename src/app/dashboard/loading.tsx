import { PageSkeleton } from '@/components/ui/page-skeleton'

// Kerangka transisi antar-halaman dashboard (bukan spinner).
export default function DashboardLoading() {
  return <PageSkeleton variant="cards" label="Memuat…" />
}
