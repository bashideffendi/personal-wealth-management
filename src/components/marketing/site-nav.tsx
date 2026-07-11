import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BILLING_ENABLED } from '@/lib/billing-flag'

/**
 * Nav sticky bersama untuk halaman marketing (legal, kontak, fitur, tentang).
 * Pola mengikuti header /about — logo, link utama, Masuk, dan CTA Coba gratis.
 * Server component; tanpa state, menu mobile mengandalkan link footer.
 * Link Harga ikut gate BILLING_ENABLED (anchor #harga tidak dirender di
 * landing saat billing beku — jangan kasih link mati).
 */
export function SiteNav({ active }: { active?: 'features' | 'about' } = {}) {
  const item = (isActive: boolean) =>
    isActive
      ? 'text-[var(--ink)]'
      : 'hover:text-[var(--ink)] transition-colors motion-reduce:transition-none'
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
        <Link href="/features" className={item(active === 'features')} aria-current={active === 'features' ? 'page' : undefined}>Fitur</Link>
        {BILLING_ENABLED && (
          <Link href="/#harga" className={item(false)}>Harga</Link>
        )}
        <Link href="/#faq" className={item(false)}>FAQ</Link>
        <Link href="/about" className={item(active === 'about')} aria-current={active === 'about' ? 'page' : undefined}>Tentang</Link>
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
