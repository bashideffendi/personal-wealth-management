import { Skeleton } from '@/components/ui/skeleton'

/**
 * PageSkeleton — kerangka halaman saat data dimuat (ganti spinner + teks
 * "Memuat…"). Bentuknya meniru tata letak umum supaya halaman tidak loncat.
 *  - dashboard: hero + baris stat + dua kartu
 *  - list: baris stat + kartu daftar
 *  - cards: dua kartu bertumpuk
 */
export function PageSkeleton({
  variant = 'cards',
  label,
}: {
  variant?: 'dashboard' | 'list' | 'cards'
  label: string
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 md:space-y-4">
      <span className="sr-only">{label}</span>
      {variant === 'dashboard' && <Skeleton className="h-44 md:h-56 rounded-xl" />}
      {variant !== 'cards' && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="s-card s-card-pad space-y-2.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
      )}
      <div className="s-card overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4"
            style={{ minHeight: 56, borderTop: i ? '1px solid var(--border-soft)' : 'none' }}
          >
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </div>
      {variant !== 'list' && <Skeleton className="h-40 rounded-xl" />}
    </div>
  )
}
