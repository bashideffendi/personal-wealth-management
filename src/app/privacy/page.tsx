import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi',
  description: 'Kebijakan privasi & perlindungan data pribadi Klunting.',
}

const UPDATED = '29 Mei 2026'

export default function PrivacyPage() {
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
          Kebijakan Privasi
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Berlaku efektif: {UPDATED}
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          <section>
            <p>
              Kebijakan ini menjelaskan bagaimana <strong>Klunting</strong> (&quot;kami&quot;), aplikasi manajemen
              keuangan pribadi di <strong>klunting.com</strong>, mengumpulkan, memakai, dan melindungi data pribadimu.
              Kami berkomitmen mematuhi <strong>UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)</strong>.
              Dengan memakai Klunting, kamu menyetujui kebijakan ini.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>1. Data yang kami kumpulkan</h2>
            <ul className="space-y-1.5 list-disc pl-5">
              <li><strong>Identitas akun:</strong> email dan nama tampilan yang kamu input saat daftar.</li>
              <li><strong>Data keuangan yang kamu catat:</strong> transaksi, dompet/akun, anggaran, aset, investasi, utang, dan tujuan.</li>
              <li><strong>Foto struk</strong> yang kamu unggah (disimpan terisolasi per-pengguna di Supabase Storage).</li>
              <li><strong>Data teknis minimal:</strong> log aktivitas (waktu login, fitur yang dipakai) untuk diagnosa bug & keamanan.</li>
            </ul>
            <p className="mt-2">
              Kami <strong>tidak</strong> mengakses rekening bankmu langsung dan tidak meminta password perbankan —
              kami hanya menyimpan apa yang kamu input sendiri.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>2. Dasar & tujuan pemrosesan</h2>
            <p>
              Kami memproses data berdasarkan <strong>persetujuanmu</strong> dan untuk <strong>menjalankan layanan</strong>
              (kontrak) — yaitu menyediakan fitur pencatatan, analisa, dan AI. Kami tidak memproses data untuk tujuan lain
              tanpa dasar yang sah.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>3. Yang kami TIDAK lakukan</h2>
            <ul className="space-y-1.5 list-disc pl-5">
              <li>Tidak menjual atau menyewakan data pribadimu ke pihak ketiga.</li>
              <li>Tidak menampilkan iklan berdasarkan data finansialmu.</li>
              <li>Tidak membagikan datamu selain ke pemroses yang diperlukan untuk menjalankan layanan (di bawah).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>4. Pemroses pihak ketiga</h2>
            <p>Untuk menjalankan layanan, data tertentu diproses oleh penyedia berikut, terikat perjanjian kerahasiaan:</p>
            <ul className="space-y-1.5 list-disc pl-5 mt-2">
              <li><strong>Supabase</strong> — database, autentikasi, dan penyimpanan (region Asia Pacific/Singapura).</li>
              <li><strong>Vercel</strong> — hosting aplikasi.</li>
              <li><strong>Penyedia model AI</strong> (mis. Anthropic/Google) — hanya untuk konten yang kamu kirim ke fitur AI (lihat poin 5).</li>
            </ul>
            <p className="mt-2">
              Sebagian pemroses berlokasi di luar Indonesia, sehingga datamu dapat ditransfer lintas negara dengan
              perlindungan setara sesuai UU PDP.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>5. Fitur AI</h2>
            <p>
              Fitur AI (scan struk, parse transaksi, insight keuangan, research saham) mengirim konten yang kamu pilih
              — teks atau gambar struk — ke penyedia model AI pihak ketiga untuk diproses. Konten ini{' '}
              <strong>tidak dipakai untuk melatih model</strong> oleh penyedia (sesuai kebijakan API mereka). Output AI
              bersifat informatif, bisa keliru, dan <strong>bukan</strong> nasihat keuangan/pajak/hukum profesional.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>6. Penyimpanan & retensi</h2>
            <p>
              Data disimpan selama akunmu aktif. Jika kamu menghapus akun, data pribadimu dihapus permanen dalam{' '}
              <strong>maksimal 30 hari</strong> (jeda ini agar kamu sempat mengekspor data bila diperlukan), kecuali yang
              wajib kami simpan oleh hukum.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>7. Hak kamu (UU PDP)</h2>
            <ul className="space-y-1.5 list-disc pl-5">
              <li><strong>Akses & portabilitas:</strong> ekspor seluruh data dalam format CSV dari menu Profil kapan saja.</li>
              <li><strong>Koreksi:</strong> perbarui datamu langsung di aplikasi.</li>
              <li><strong>Penghapusan:</strong> hapus akun & seluruh data dari Profil → Hapus Akun.</li>
              <li><strong>Penarikan persetujuan:</strong> berhenti memakai layanan dan hapus akun kapan saja.</li>
              <li><strong>Informasi:</strong> minta penjelasan data yang kami simpan via email di bawah.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>8. Keamanan</h2>
            <p>
              Password disimpan dalam bentuk hash (bukan teks asli) oleh Supabase Auth. Komunikasi dienkripsi TLS
              (HTTPS). Data antar-pengguna terisolasi dengan Row Level Security di database. Bila terjadi kebocoran data
              yang berisiko merugikanmu, kami akan memberi tahu kamu dan otoritas sesuai ketentuan UU PDP.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>9. Cookie</h2>
            <p>
              Kami memakai cookie minimal untuk sesi login dan preferensi (tema, bahasa). Tidak ada cookie pelacak iklan.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>10. Usia</h2>
            <p>Klunting ditujukan untuk pengguna berusia 17 tahun ke atas. Kami tidak sengaja mengumpulkan data anak.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>11. Perubahan & kontak</h2>
            <p>
              Kebijakan ini dapat diperbarui; perubahan material diberitahukan via email atau notifikasi in-app.
              Pertanyaan privasi kirim ke{' '}
              <a href="mailto:support@klunting.com" className="underline font-medium" style={{ color: 'var(--ink)' }}>
                support@klunting.com
              </a>{' '}atau WhatsApp/telepon{' '}
              <a href="https://wa.me/628558829500" className="underline font-medium" style={{ color: 'var(--ink)' }}>
                0855-8829-500
              </a>.
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
