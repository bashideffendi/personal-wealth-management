import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Lock, RefreshCcw, MapPin, Download, Tag, type LucideIcon } from 'lucide-react'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'Tentang',
  description: 'Apa itu Klunting, kenapa dibuat, dan prinsip yang kami pegang: privasi, tanpa auto-renew, dan Indonesia-first.',
}

type Principle = { icon: LucideIcon; title: string; body: string }

const PRINCIPLES: Principle[] = [
  { icon: Lock, title: 'Privasi dulu', body: 'Kami tidak menampilkan iklan dan tidak menjual data. Model bisnis kami adalah langganan, bukan datamu.' },
  { icon: RefreshCcw, title: 'Tanpa auto-renew', body: 'Langganan tidak diperpanjang diam-diam. Kami mengingatkan sebelum masa habis, dan kamu yang memutuskan.' },
  { icon: MapPin, title: 'Indonesia-first', body: 'Rupiah, kategori lokal, riset saham IDX, dan pembacaan struk Bahasa Indonesia — dibangun untuk konteks di sini.' },
  { icon: Download, title: 'Datamu milikmu', body: 'Ekspor seluruh data ke CSV kapan saja, dan hapus akun permanen bila mau. Tanpa penguncian.' },
  { icon: Tag, title: 'Harga jujur', body: 'Harga tertera apa adanya, tanpa biaya tersembunyi. Coba dulu 21 hari sebelum membayar.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <SiteNav active="about" />

      <main className="px-6 sm:px-12 py-16 sm:py-20">
        <div className="max-w-2xl mx-auto">
          <p className="eyebrow">Tentang</p>
          <h1 className="mt-3 font-bold tracking-tight" style={{ fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.08, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            Kenapa Klunting ada.
          </h1>

          <div className="mt-8 space-y-5 text-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            <p>
              Keuangan kebanyakan orang tersebar di banyak tempat: rekening di beberapa bank, saldo
              e-wallet, portofolio investasi, cicilan, dan catatan pengeluaran yang jarang lengkap.
              Akibatnya, satu pertanyaan sederhana jadi sulit dijawab: sebenarnya, seperti apa
              posisi keuanganku saat ini?
            </p>
            <p>
              Klunting dibuat untuk menjawab itu. Satu tempat untuk melihat seluruh aset dan utang
              sebagai satu angka net worth, memahami arus kas, dan mengambil keputusan dengan data,
              bukan tebakan.
            </p>
            <p>
              Klunting adalah produk independen yang dikembangkan dari Indonesia, untuk pengguna di
              Indonesia. Kami memilih membangun pelan tapi benar: fitur yang berguna, harga yang
              jujur, dan kendali penuh atas data ada di tanganmu.
            </p>
          </div>
        </div>

        {/* Principles */}
        <div className="max-w-2xl mx-auto mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>Prinsip yang kami pegang</h2>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="s-card p-5">
                <div className="size-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--surface-2)' }}>
                  <p.icon className="size-5" style={{ color: 'var(--ink)' }} />
                </div>
                <h3 className="t-title mb-1" style={{ color: 'var(--ink)' }}>{p.title}</h3>
                <p className="t-body" style={{ color: 'var(--ink-muted)' }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Honest note */}
        <div className="max-w-2xl mx-auto mt-10 rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="t-body" style={{ color: 'var(--ink-muted)' }}>
            Klunting adalah <strong>alat bantu pencatatan dan pemantauan keuangan</strong>, bukan
            lembaga jasa keuangan atau penasihat investasi berlisensi. Riset dan angka yang
            ditampilkan bersifat informatif, bukan nasihat investasi. Selalu lakukan pertimbangan sendiri
            sebelum mengambil keputusan finansial.
          </p>
        </div>

        {/* CTA */}
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
            Coba gratis 21 hari <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
