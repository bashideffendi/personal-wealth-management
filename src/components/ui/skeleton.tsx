import { cn } from '@/lib/utils'

/** Skeleton — blok placeholder berdenyut; bentuknya ikut konten aslinya. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-lg', className)}
      style={{ background: 'var(--surface-2)', ...style }}
    />
  )
}
