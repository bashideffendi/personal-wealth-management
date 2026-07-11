'use client'

/**
 * Reveal — fade-up SEKALI saat elemen masuk viewport (landing only).
 * Progressive enhancement: HTML server-rendered tetap visible (SEO / no-JS
 * aman); state "hidden" baru dipasang setelah hydration, dan HANYA untuk
 * elemen yang masih di bawah fold saat mount (yang sudah kelihatan tidak
 * dikedipkan). prefers-reduced-motion: reduce → tanpa motion sama sekali.
 * Sekali ter-reveal, observer di-disconnect — tidak pernah re-trigger.
 */

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

export function Reveal({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Sudah (sebagian) kelihatan saat mount → biarkan diam, jangan flash.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return

    el.style.opacity = '0'
    el.style.transform = 'translateY(12px)'

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        el.style.transition = 'opacity 400ms ease-out, transform 400ms ease-out'
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
        io.disconnect()
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}
