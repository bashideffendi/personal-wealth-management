import Link from 'next/link'
import type { Metadata } from 'next'
import { Mail, MessageCircle, Clock, MapPin } from 'lucide-react'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'Hubungi Kami',
  description: 'Kontak dukungan Klunting — email, WhatsApp, dan jam operasional.',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <SiteNav />

      <main className="max-w-2xl mx-auto px-6 sm:px-12 py-12">
        <p className="text-xs uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--ink-soft)' }}>Dukungan</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.025em' }}>Hubungi Kami</h1>
        <p className="mt-3 text-sm leading-relaxed max-w-lg" style={{ color: 'var(--ink-muted)' }}>
          Ada pertanyaan soal akun, pembayaran, atau fitur Klunting? Tim kami siap bantu. Pilih kanal yang paling nyaman buat kamu.
        </p>

        <div className="mt-8 grid sm:grid-cols-2 gap-3">
          <a href="mailto:support@klunting.com" className="s-card p-5 transition hover:border-[var(--ink)] block" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="size-10 rounded-xl grid place-items-center" style={{ background: 'var(--c-mint-soft)' }}><Mail className="size-5" style={{ color: 'var(--c-mint-ink)' }} /></div>
            <p className="font-semibold mt-3" style={{ color: 'var(--ink)' }}>Email</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>support@klunting.com</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>Balasan dalam ≤1 hari kerja</p>
          </a>
          <a href="https://wa.me/628558829500" className="s-card p-5 transition hover:border-[var(--ink)] block" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="size-10 rounded-xl grid place-items-center" style={{ background: 'var(--c-mint-soft)' }}><MessageCircle className="size-5" style={{ color: 'var(--c-mint-ink)' }} /></div>
            <p className="font-semibold mt-3" style={{ color: 'var(--ink)' }}>WhatsApp / Telepon</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>0855-8829-500</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>Chat lebih cepat direspons</p>
          </a>
          <div className="s-card p-5" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="size-10 rounded-xl grid place-items-center" style={{ background: 'var(--surface-2)' }}><Clock className="size-5" style={{ color: 'var(--ink)' }} /></div>
            <p className="font-semibold mt-3" style={{ color: 'var(--ink)' }}>Jam Operasional</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>Senin–Jumat, 09.00–18.00 WIB</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>Email di luar jam tetap masuk antrian</p>
          </div>
          <div className="s-card p-5" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="size-10 rounded-xl grid place-items-center" style={{ background: 'var(--surface-2)' }}><MapPin className="size-5" style={{ color: 'var(--ink)' }} /></div>
            <p className="font-semibold mt-3" style={{ color: 'var(--ink)' }}>Lokasi</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>Beroperasi di Indonesia 🇮🇩</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>Layanan berbasis web (PWA)</p>
          </div>
        </div>

        <div className="mt-8 s-card p-5" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            <strong style={{ color: 'var(--ink)' }}>Tentang Klunting.</strong> Klunting adalah aplikasi manajemen keuangan pribadi berbasis web yang membantu mencatat transaksi, memantau net worth, anggaran, investasi, utang, dan tujuan finansial dalam satu tempat. Layanan berlangganan dengan trial 21 hari gratis. Lihat <Link href="/terms" className="underline font-medium" style={{ color: 'var(--ink)' }}>Syarat &amp; Ketentuan</Link>, <Link href="/privacy" className="underline font-medium" style={{ color: 'var(--ink)' }}>Kebijakan Privasi</Link>, dan <Link href="/refund" className="underline font-medium" style={{ color: 'var(--ink)' }}>Kebijakan Pengembalian Dana</Link>.
          </p>
        </div>

        <div className="mt-10 pt-6 border-t" style={{ borderColor: 'var(--border-soft)' }}>
          <Link href="/" className="text-sm font-medium hover:underline" style={{ color: 'var(--c-mint-ink)' }}>← Kembali ke beranda</Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
