import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan',
  description: 'Syarat & ketentuan penggunaan Klunting.',
}

const UPDATED = '29 Mei 2026'

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <header
        className="flex items-center justify-between px-6 sm:px-12 py-5 border-b"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="grid place-items-center"
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'var(--c-primary)',
              color: 'var(--c-primary-foreground)', fontFamily: 'var(--font-sans)', fontWeight: 800,
              fontSize: 16, letterSpacing: '-0.04em',
              boxShadow: '0 4px 12px -4px rgba(16, 24, 40, 0.12)',
            }}
          >
            K
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Klunting
          </span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 sm:px-12 py-12">
        <p className="text-xs uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--ink-soft)' }}>
          Legal
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.025em' }}>
          Syarat & Ketentuan
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Berlaku efektif: {UPDATED}
        </p>

        <div className="prose-section mt-8 space-y-6 text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>1. Penerimaan</h2>
            <p>
              Dengan mendaftar atau memakai Klunting (klunting.com), kamu menyetujui Syarat & Ketentuan ini beserta{' '}
              <Link href="/privacy" className="underline font-medium" style={{ color: 'var(--ink)' }}>Kebijakan Privasi</Link>.
              Jika tidak setuju, mohon tidak menggunakan layanan.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>2. Layanan</h2>
            <p>
              Klunting adalah aplikasi pencatatan & analisa keuangan pribadi. Kami <strong>bukan</strong> lembaga jasa
              keuangan, bukan penasihat investasi, dan tidak memberikan nasihat investasi, perpajakan, atau hukum.
              Seluruh keputusan keuanganmu adalah tanggung jawabmu sendiri.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>3. Akun</h2>
            <p>
              Kamu wajib menjaga kerahasiaan kredensial akunmu dan bertanggung jawab atas aktivitas di dalamnya. Beri tahu
              kami segera bila ada akses tidak sah. Klunting ditujukan untuk pengguna berusia 17 tahun ke atas.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>4. Trial, langganan & pembayaran</h2>
            <ul className="space-y-1.5 list-disc pl-5">
              <li>Pengguna baru mendapat <strong>uji coba (trial) 21 hari</strong> akses penuh, tanpa kartu kredit.</li>
              <li>Setelah trial, kamu memilih paket berbayar (<strong>Pro</strong> atau <strong>Max</strong>) dengan <strong>penagihan tahunan</strong>.</li>
              <li><strong>Tanpa perpanjangan otomatis (no auto-renew).</strong> Kami mengirim notifikasi sebelum masa langganan habis, dan kamu yang memutuskan untuk memperpanjang secara manual.</li>
              <li>Harga dapat berubah; perubahan hanya berlaku untuk periode langganan berikutnya, bukan yang sedang berjalan.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>5. Kredit AI</h2>
            <p>
              Fitur AI memakai sistem kredit. Tiap paket memberi sejumlah kredit per bulan; kredit yang dibeli terpisah
              (top-up) tidak kedaluwarsa. Kredit tidak dapat diuangkan kembali (non-refundable) dan tidak dapat
              dipindahkan antar-akun.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>6. Pengembalian dana</h2>
            <p>
              Karena ada trial 21 hari gratis untuk mencoba sebelum membayar, biaya langganan tahunan pada umumnya tidak
              dapat dikembalikan setelah pembayaran. Bila ada kendala, hubungi kami dan akan kami tinjau secara wajar.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>7. Data kamu</h2>
            <p>
              Data finansial yang kamu input tetap milikmu. Kamu dapat mengekspornya (CSV) atau menghapus akunmu kapan
              saja. Penanganan data diatur dalam{' '}
              <Link href="/privacy" className="underline font-medium" style={{ color: 'var(--ink)' }}>Kebijakan Privasi</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>8. Penggunaan yang dilarang</h2>
            <p>
              Dilarang menyalahgunakan layanan: spam, penipuan, scraping otomatis, mengakses akun orang lain, atau
              mengganggu keamanan/infrastruktur. Kami berhak menonaktifkan akun yang melanggar.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>9. Akurasi AI & ketersediaan</h2>
            <p>
              Output AI (scan struk, insight, research) dapat mengandung kesalahan — selalu verifikasi sebelum dipakai
              untuk keputusan penting. Layanan disediakan &quot;sebagaimana adanya&quot; (as-is); kami berupaya menjaga
              ketersediaan namun tidak menjamin bebas gangguan.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>10. Batasan tanggung jawab</h2>
            <p>
              Sepanjang diizinkan hukum, Klunting tidak bertanggung jawab atas kerugian tidak langsung yang timbul dari
              penggunaan layanan, termasuk keputusan finansial yang kamu ambil berdasarkan data atau output AI.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>11. Hukum yang berlaku</h2>
            <p>Syarat ini tunduk pada hukum Republik Indonesia.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>12. Perubahan & kontak</h2>
            <p>
              Syarat ini dapat berubah; perubahan material diberitahukan via email atau notifikasi in-app minimal 14 hari
              sebelumnya. Pertanyaan atau keluhan kirim ke{' '}
              <a href="mailto:support@klunting.com" className="underline font-medium" style={{ color: 'var(--ink)' }}>
                support@klunting.com
              </a>{' '}atau WhatsApp/telepon{' '}
              <a href="https://wa.me/628558829500" className="underline font-medium" style={{ color: 'var(--ink)' }}>
                0855-8829-500
              </a>. Lihat juga <Link href="/refund" className="underline font-medium" style={{ color: 'var(--ink)' }}>Kebijakan Pengembalian Dana</Link>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t" style={{ borderColor: 'var(--border-soft)' }}>
          <Link href="/" className="text-sm font-medium hover:underline" style={{ color: 'var(--c-mint)' }}>
            ← Kembali ke beranda
          </Link>
        </div>
      </main>
    </div>
  )
}
