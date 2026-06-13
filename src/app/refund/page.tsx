import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kebijakan Pengembalian Dana',
  description: 'Kebijakan pengembalian dana (refund) & pembatalan langganan Klunting.',
}

const UPDATED = '2 Juni 2026'

export default function RefundPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <header className="flex items-center justify-between px-6 sm:px-12 py-5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid place-items-center" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em', boxShadow: 'var(--card-shadow)' }}>K</div>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Klunting</span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 sm:px-12 py-12">
        <p className="text-xs uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--ink-soft)' }}>Legal</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.025em' }}>Kebijakan Pengembalian Dana</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>Berlaku efektif: {UPDATED}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          <section>
            <p>Kebijakan ini menjelaskan ketentuan pengembalian dana (refund) dan pembatalan untuk langganan berbayar <strong>Klunting</strong> (klunting.com). Dengan berlangganan, kamu menyetujui ketentuan ini bersama <Link href="/terms" className="underline font-medium" style={{ color: 'var(--ink)' }}>Syarat &amp; Ketentuan</Link>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>1. Coba dulu, baru bayar</h2>
            <p>Setiap pengguna baru dapat <strong>uji coba (trial) 21 hari akses penuh tanpa kartu kredit</strong>. Manfaatkan masa trial untuk memastikan Klunting cocok sebelum melakukan pembayaran. Kamu tidak akan ditagih apa pun selama atau setelah trial kecuali kamu memilih berlangganan secara aktif.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>2. Jaminan pengembalian dana 14 hari</h2>
            <p>Jika kamu sudah membayar langganan tahunan dan merasa tidak puas, kamu dapat mengajukan pengembalian dana <strong>dalam 14 (empat belas) hari sejak tanggal pembayaran pertama</strong>. Selama periode ini, refund diproses tanpa pertanyaan rumit.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>3. Cara mengajukan refund</h2>
            <p>Hubungi kami melalui salah satu kanal berikut dengan menyertakan <strong>email akun</strong> dan <strong>tanggal pembayaran</strong>:</p>
            <ul className="space-y-1.5 list-disc pl-5 mt-2">
              <li>Email: <a href="mailto:support@klunting.com" className="underline font-medium" style={{ color: 'var(--ink)' }}>support@klunting.com</a></li>
              <li>WhatsApp / Telepon: <a href="https://wa.me/628558829500" className="underline font-medium" style={{ color: 'var(--ink)' }}>0855-8829-500</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>4. Proses &amp; waktu</h2>
            <p>Permintaan ditinjau dalam <strong>maksimal 3 hari kerja</strong>. Setelah disetujui, dana dikembalikan ke <strong>metode pembayaran asal</strong> dalam <strong>maksimal 14 hari</strong>, mengikuti jadwal pemrosesan kanal pembayaran (mis. bank, e-wallet, atau kartu). Lama dana masuk ke rekeningmu bisa bergantung pada penyedia pembayaran.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>5. Yang tidak dapat dikembalikan</h2>
            <ul className="space-y-1.5 list-disc pl-5">
              <li><strong>Kredit AI top-up</strong> yang sudah terpakai (kredit yang belum dipakai masih bisa ditinjau).</li>
              <li>Pembayaran di luar jendela 14 hari, kecuali ada kegagalan layanan dari pihak kami yang tidak dapat kami selesaikan.</li>
              <li>Perpanjangan untuk periode yang sedang berjalan (lihat poin 6).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>6. Pembatalan langganan</h2>
            <p>Klunting <strong>tidak memakai perpanjangan otomatis (no auto-renew)</strong>. Artinya kamu tidak perlu &ldquo;membatalkan&rdquo; apa pun — langganan berhenti dengan sendirinya di akhir periode kecuali kamu memperpanjang manual. Setelah periode habis, akun beralih ke mode hanya-baca; datamu tetap bisa diekspor (CSV) atau dihapus kapan saja.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>7. Kontak</h2>
            <p>Pertanyaan seputar pembayaran atau refund hubungi <a href="mailto:support@klunting.com" className="underline font-medium" style={{ color: 'var(--ink)' }}>support@klunting.com</a> atau WhatsApp <a href="https://wa.me/628558829500" className="underline font-medium" style={{ color: 'var(--ink)' }}>0855-8829-500</a> (Senin–Jumat, 09.00–18.00 WIB).</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t flex flex-wrap gap-4" style={{ borderColor: 'var(--border-soft)' }}>
          <Link href="/" className="text-sm font-medium hover:underline" style={{ color: 'var(--c-mint)' }}>← Kembali ke beranda</Link>
          <Link href="/terms" className="text-sm font-medium hover:underline" style={{ color: 'var(--ink-muted)' }}>Syarat &amp; Ketentuan</Link>
          <Link href="/contact" className="text-sm font-medium hover:underline" style={{ color: 'var(--ink-muted)' }}>Hubungi Kami</Link>
        </div>
      </main>
    </div>
  )
}
