import Link from 'next/link'
import { BILLING_ENABLED } from '@/lib/billing-flag'

/**
 * Footer bersama untuk halaman marketing (legal, kontak, fitur, tentang).
 * Pola mengikuti footer /about — baris link + disclaimer dari footer landing.
 * Server component, token murni. Link Harga ikut gate BILLING_ENABLED.
 */
export function SiteFooter() {
  return (
    <footer className="border-t px-6 sm:px-12 py-8" style={{ borderColor: 'var(--border-soft)' }}>
      <div className="max-w-2xl mx-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
        <Link href="/" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Beranda</Link>
        <Link href="/features" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Fitur</Link>
        {BILLING_ENABLED && (
          <Link href="/#harga" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Harga</Link>
        )}
        <Link href="/about" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Tentang</Link>
        <Link href="/contact" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Hubungi Kami</Link>
        <Link href="/terms" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Syarat</Link>
        <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Privasi</Link>
        <Link href="/refund" className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">Pengembalian Dana</Link>
      </div>
      <div className="max-w-2xl mx-auto mt-6 pt-5 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border-soft)' }}>
        <p className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>© {new Date().getFullYear()} Klunting</p>
        <p className="text-[11px] max-w-md sm:text-right" style={{ color: 'var(--ink-soft)' }}>
          Klunting adalah alat bantu pencatatan keuangan, <strong>bukan</strong> lembaga jasa keuangan atau penasihat investasi berlisensi.
        </p>
      </div>
    </footer>
  )
}
