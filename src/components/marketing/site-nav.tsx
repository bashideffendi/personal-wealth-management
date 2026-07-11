import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/**
 * Nav sticky bersama untuk halaman marketing sekunder (legal, kontak).
 * Pola mengikuti header /about — logo, link utama, Masuk, dan CTA Coba gratis.
 * Server component; tanpa state, menu mobile mengandalkan link footer.
 */
export function SiteNav() {
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-12 py-4 border-b backdrop-blur"
      style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
    >
      <Link href="/" className="flex items-center gap-2.5" aria-label="Klunting">
        <div className="grid place-items-center" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em' }}>K</div>
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Klunting</span>
      </Link>

      <nav className="hidden md:flex gap-7 text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
        <Link href="/features" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Fitur</Link>
        <Link href="/#harga" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Harga</Link>
        <Link href="/#faq" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">FAQ</Link>
        <Link href="/about" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Tentang</Link>
      </nav>

      <div className="flex items-center gap-2">
        <Link href="/login" className="hidden sm:block px-3 py-2 text-sm font-medium rounded-md hover:bg-[var(--surface-2)] transition-colors motion-reduce:transition-none" style={{ color: 'var(--ink)' }}>Masuk</Link>
        <Link href="/register" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90 motion-reduce:transition-none" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
          Coba gratis <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </header>
  )
}
