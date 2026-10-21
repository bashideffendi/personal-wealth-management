# Instruksi Lanjutan: Audit Mendalam Klunting (Keamanan + Kebenaran Angka)

Kerjakan di branch `audit/2026-10` (`git pull` dulu). Jangan merge ke `master`, jangan deploy produksi, dan jangan terapkan migrasi ke Supabase. Berkas SQL baru boleh ditulis, tandai "BELUM DITERAPKAN". Teliti tapi tetap hemat token: baca kode yang relevan, jangan menelusuri semuanya.

Audit ringan sebelumnya ada di `docs/AUDIT_2026_10.md` dan sudah memperbaiki Next 16.3.8 dan paginasi 1000 baris. Lanjutkan dari situ, jangan ulangi.

## A. Keamanan Menyeluruh

1. **RLS tabel per tabel.** Ambil semua tabel dari `supabase/migrations/` (sampai 068). Untuk setiap tabel periksa:
   - RLS aktif;
   - policy SELECT/INSERT/UPDATE/DELETE membatasi ke `auth.uid()` atau keanggotaan household yang sah;
   - tidak ada policy `using (true)`;
   - fungsi `SECURITY DEFINER` punya `search_path` tetap dan cek pemilik.

   Hasilnya tabel: tabel → status → masalah → perbaikan. Perbaikan RLS ditulis sebagai migrasi baru `069_*.sql` yang BELUM DITERAPKAN.
2. **Otorisasi setiap API route** di `src/app/api/**`, termasuk:
   - billing, cron, delete-account, export-data, household, import-mutasi, push, extract-receipt dan parse-transaction;
   - route AI (cek kuota/rate limit);
   - semua route yang menerima ID dari klien.

   Pertanyaan kuncinya: bisakah pengguna A membaca atau mengubah data pengguna B dengan mengganti ID? Route cron harus diproteksi `CRON_SECRET`, webhook harus diverifikasi tanda tangannya, dan service-role key tidak boleh terpakai di jalur yang dipicu pengguna tanpa cek kepemilikan.
3. **Klien dan header.**
   - Tidak ada secret di bundle klien; `NEXT_PUBLIC_*` hanya nilai publik.
   - CSP, header keamanan dan `proxy.ts`/middleware: rute publik vs terproteksi.
   - Sentry tetap privasi-aman.
   - Upload (`extract-receipt`) membatasi tipe dan ukuran.
   - Input AI tidak bisa memicu aksi tak sah (prompt injection pada parse-transaction).
4. **Data pribadi.** Ekspor dan hapus akun menghapus atau mengekspor semua tabel milik pengguna. Tidak ada PII di log.

## B. Kebenaran Angka Uang Ujung ke Ujung

1. **Net worth.** Masih dihitung di 6 tempat. Satukan ke satu fungsi murni (misalnya `src/lib/data/net-worth.ts`) beserta tesnya, lalu semua tempat memakainya. Angka hasil untuk data yang sama tidak boleh berubah, kecuali memang ada bug, dan bug itu harus dijelaskan.
2. **Skenario uji nyata** sebagai unit/integration test pada fungsi murni, untuk:
   - transfer antar-rekening;
   - bayar kartu kredit (penuh, sebagian, dibatalkan);
   - bayar utang dan cicilan;
   - import mutasi ke rekening dan ke kartu;
   - transaksi pada pergantian bulan dan tahun, serta zona waktu WIB;
   - mata uang dan pembulatan;
   - pengguna dengan lebih dari 1000 transaksi;
   - anggaran (realisasi, sisa, siklus);
   - Goals;
   - Forecast Saldo.

   Tiap skenario harus menghasilkan angka yang sama di dashboard, halaman terkait dan laporan bulanan.
3. **Temuan P1/P2 dari audit ringan.**
   - Perbaiki: kegagalan muat yang tampil 0, bukan pesan error.
   - Perbaiki: pembatalan bayar kartu yang menulis saldo langsung tanpa lewat `balances.ts`.
   - Laporkan saja: Transaksi yang mengambil semua data sepanjang masa (lambat). Perbaiki hanya kalau mudah dan aman.
4. **Kontrak yang tidak boleh berubah** kecuali karena bug yang terbukti dan dijelaskan:
   - `src/lib/data/cashflow-forecast.ts`;
   - semantik `balances.ts`;
   - struktur Sankey hub;
   - Calm Mode.

## C. Cek Next 16.3 di Vercel

Proyek lain milik pemilik pernah kena masalah CSS basi dari cache build di Next 16.3 + Vercel. Perbaikannya `experimental.turbopackFileSystemCacheForBuild: false` di `next.config`. Cek apakah setelan ini perlu, tambahkan kalau ragu, lalu pastikan CSS hasil build berisi kelas terbaru.

## Aturan Perbaikan

- Perbaiki semua masalah P0 (kebocoran data, salah angka uang, bypass otorisasi) dan P1 yang aman, dengan commit kecil + tes per perbaikan.
- `npm run build` + tes lulus sebelum push.
- Kalau sebuah perbaikan menuntut migrasi atau mengubah perilaku yang terlihat pengguna, tulis migrasinya (belum diterapkan) atau laporkan saja, lalu jelaskan.

## Selesai Berarti

- `docs/AUDIT_2026_10_DEEP.md`, berisi:
  - tabel RLS;
  - tabel otorisasi route;
  - daftar skenario angka beserta hasilnya;
  - perbaikan yang dilakukan (commit);
  - hal yang perlu tindakan pemilik, misalnya menerapkan migrasi 069 atau mengisi env;
  - ringkasan 10 baris.
- Semua ter-push ke `audit/2026-10`.
