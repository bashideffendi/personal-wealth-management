import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan',
  description: 'Syarat & ketentuan penggunaan Klunting.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <header
        className="flex items-center justify-between px-6 sm:px-12 py-5 border-b"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div className="kl-brandmark" style={{ width: 32, height: 32, borderRadius: 10 }}>
            <span>K</span>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-sans)', fontWeight: 700,
              fontSize: 20,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          >
            Klunting
          </span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 sm:px-12 py-12">
        <p className="text-xs uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--ink-soft)' }}>
          Legal · Draft
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.025em' }}>
          Syarat & Ketentuan
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Terakhir diperbarui: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        <div
          className="mt-6 rounded-xl border p-4 text-sm"
          style={{
            background: 'var(--warning-bg)',
            borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)',
            color: 'var(--ink)',
          }}
        >
          Dokumen ini masih draft. Versi final akan dipublikasikan sebelum Klunting keluar dari fase beta.
          Saran atau pertanyaan kirim ke{' '}
          <a href="mailto:support@klunting.com" className="underline font-medium">
            support@klunting.com
          </a>
          .
        </div>

        <div className="prose-section mt-8 space-y-6 text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              1. Penerimaan
            </h2>
            <p>
              Dengan mendaftar atau menggunakan Klunting, kamu menyetujui Syarat & Ketentuan ini. Kalau kamu tidak setuju,
              mohon tidak menggunakan layanan.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              2. Layanan
            </h2>
            <p>
              Klunting adalah aplikasi pencatatan keuangan pribadi. Kami tidak memberikan saran investasi, perpajakan,
              atau hukum. Keputusan keuangan kamu adalah tanggung jawab kamu sendiri.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              3. Akun
            </h2>
            <p>
              Kamu wajib menjaga kerahasiaan password. Kami tidak bertanggung jawab atas akses tidak sah jika kamu lalai
              menjaga kredensial.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              4. Data kamu
            </h2>
            <p>
              Data finansial yang kamu input tetap milik kamu. Klunting menyimpannya untuk menyediakan layanan, dan
              tidak menjual data ke pihak ketiga. Detail lebih jauh ada di{' '}
              <Link href="/privacy" className="underline font-medium" style={{ color: 'var(--ink)' }}>
                Kebijakan Privasi
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              5. Pembayaran & langganan
            </h2>
            <p>
              Setelah trial 14 hari, langganan akan diperpanjang otomatis kecuali kamu cancel. Pembatalan dapat
              dilakukan kapan saja dari halaman Profil → Langganan.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              6. Penghentian
            </h2>
            <p>
              Kami berhak menonaktifkan akun yang menyalahgunakan layanan (spam, fraud, scraping). Data akan disimpan 30
              hari sebelum dihapus, agar kamu sempat export jika diperlukan.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              7. Perubahan
            </h2>
            <p>
              Syarat & Ketentuan dapat berubah. Perubahan material akan diberitahukan via email atau notifikasi in-app
              minimal 14 hari sebelumnya.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              8. Kontak
            </h2>
            <p>
              Pertanyaan, sengketa, atau keluhan kirim ke{' '}
              <a href="mailto:support@klunting.com" className="underline font-medium" style={{ color: 'var(--ink)' }}>
                support@klunting.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t" style={{ borderColor: 'var(--border-soft)' }}>
          <Link
            href="/"
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--c-mint)' }}
          >
            ← Kembali ke beranda
          </Link>
        </div>
      </main>
    </div>
  )
}
