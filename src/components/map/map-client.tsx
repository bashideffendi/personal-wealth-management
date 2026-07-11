'use client'

import { Suspense, lazy, useEffect, useState, type ComponentProps } from 'react'

// SSR-safe wrapper: Leaflet nyentuh `window` pas di-import, jadi modul peta
// baru di-load setelah mount di client (React.lazy di belakang gate mounted —
// bukan next/dynamic, karena `loading` di dynamic() gak bisa nerima props).
// Placeholder loading ikut `height` dari pemakai biar gak ada CLS
// (dulu placeholder fix 240px vs pemakaian nyata 112/380px).

const LeafletMapLazy = lazy(() => import('./leaflet-map'))
const PortfolioMapLazy = lazy(() => import('./portfolio-map'))

type LeafletMapProps = ComponentProps<typeof LeafletMapLazy>
type PortfolioMapProps = ComponentProps<typeof PortfolioMapLazy>

function MapPlaceholder({ height }: { height: number }) {
  return (
    <div
      className="w-full rounded-lg border flex items-center justify-center text-xs"
      style={{
        height,
        background: 'var(--surface-2)',
        borderColor: 'var(--border-soft)',
        color: 'var(--ink-soft)',
      }}
    >
      Memuat peta…
    </div>
  )
}

function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted
}

export function LeafletMap(props: LeafletMapProps) {
  const mounted = useMounted()
  const fallback = <MapPlaceholder height={props.height ?? 240} />
  if (!mounted) return fallback
  return (
    <Suspense fallback={fallback}>
      <LeafletMapLazy {...props} />
    </Suspense>
  )
}

export function PortfolioMap(props: PortfolioMapProps) {
  const mounted = useMounted()
  const fallback = <MapPlaceholder height={props.height ?? 380} />
  if (!mounted) return fallback
  return (
    <Suspense fallback={fallback}>
      <PortfolioMapLazy {...props} />
    </Suspense>
  )
}
