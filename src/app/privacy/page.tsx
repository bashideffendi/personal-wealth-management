import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi',
  description: 'Kebijakan privasi & perlindungan data Klunting.',
}

export default function PrivacyPage() {
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
              fontFamily: 'var(--font-display)',
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
          Kebijakan Privasi
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
        </div>

        <div className="mt-8 space-y-6 text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              Data yang kami simpan
            </h2>
            <ul className="space-y-1.5 list-disc pl-5">
              <li>Email, nama (yang kamu input saat daftar).</li>
              <li>Transaksi, akun, anggaran, dan aset yang kamu catat.</li>
              <li>Foto struk yang kamu upload (disimpan di Supabase Storage milik kami).</li>
              <li>Log usage minimal (kapan login, fitur yang dipakai) untuk diagnosa bug.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              Apa yang kami TIDAK lakukan
            </h2>
            <ul className="space-y-1.5 list-disc pl-5">
              <li>Tidak menjual data ke pihak ketiga.</li>
              <li>Tidak menjalankan iklan berdasarkan data finansial kamu.</li>
              <li>Tidak mengakses rekening bank kamu langsung — kami hanya menyimpan apa yang kamu input.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              AI & pemrosesan
            </h2>
            <p>
              Fitur AI (scan struk, parse transaksi, insight bulanan) memakai model dari Anthropic (Claude). Konten yang
              dikirim untuk diproses adalah teks/gambar struk yang kamu kasih. Anthropic tidak menyimpan konten untuk
              training (per kebijakan API mereka).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              Hak kamu
            </h2>
            <ul className="space-y-1.5 list-disc pl-5">
              <li>Export semua data dalam format CSV kapan saja dari menu Profil.</li>
              <li>Hapus akun & seluruh data permanen dari menu Profil → Hapus Akun.</li>
              <li>Minta penjelasan data apa yang kami simpan tentang kamu via support email.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              Keamanan
            </h2>
            <p>
              Password kamu disimpan dalam bentuk hash (bukan plaintext) oleh Supabase Auth. Komunikasi browser-server
              dienkripsi TLS. Data per-user terisolasi pakai Row Level Security di database.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              Cookie
            </h2>
            <p>
              Kami pakai cookie minimal untuk session login dan preferensi (tema, bahasa). Tidak ada cookie tracking
              iklan.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              Kontak
            </h2>
            <p>
              Pertanyaan privasi kirim ke{' '}
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
