'use client'

/**
 * CountUp — angka menghitung naik SEKALI saat masuk viewport (600ms,
 * tabular-nums, format id-ID). Server me-render nilai FINAL (prerender/SEO
 * aman); animasi dipasang setelah hydration hanya untuk elemen di bawah fold,
 * via mutasi textContent langsung (tanpa setState → nol re-render React).
 * prefers-reduced-motion: reduce → langsung nilai final, tanpa animasi.
 */

import { useEffect, useRef, type CSSProperties } from 'react'

const fmt = (n: number) => n.toLocaleString('id-ID')

export function CountUp({
  value,
  className,
  style,
}: {
  value: number
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Sudah kelihatan saat mount → biarkan nilai final, jangan reset ke 0.
    if (el.getBoundingClientRect().top < window.innerHeight) return

    let raf = 0
    el.textContent = fmt(0)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        io.disconnect()
        const t0 = performance.now()
        const DUR = 600
        const tick = (t: number) => {
          const p = Math.min((t - t0) / DUR, 1)
          const eased = 1 - (1 - p) ** 3 // ease-out cubic
          el.textContent = fmt(Math.round(value * eased))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      el.textContent = fmt(value) // unmount/cleanup → pastikan nilai final
    }
  }, [value])

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ''}`} style={style}>
      {fmt(value)}
    </span>
  )
}
