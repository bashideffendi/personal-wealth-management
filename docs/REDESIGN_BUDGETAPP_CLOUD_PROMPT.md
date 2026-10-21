# Instruksi Sesi Cloud: Perbaikan Desain Klunting (Premium, Rapi, Minimal)

Kerjakan di branch `redesign/budget-app`. Jangan merge ke `master`, jangan deploy produksi, dan jangan terapkan migrasi ke Supabase. Kalau butuh skema baru, tulis berkas SQL di `supabase/migrations/` saja dan tandai "BELUM DITERAPKAN". Bekerja hemat token dan fokus pada dampak terbesar.

## Tujuan

Pemilik ingin Klunting **lebih premium, rapi, minimal, dan sama sekali bukan AI slop** di semua halaman, terutama tampilan HP. Ini perbaikan menyeluruh, bukan daftar fitur wajib. Pemilik menilai hasil lewat preview Vercel, bukan lewat dokumen rencana.

## Bahan Referensi (Bukan Mandat)

- **Review lama pemilik (29 Jul):** `docs/design-review/Budget/DESIGN_REVIEW.md` beserta gambarnya. Pakai sebagai ide dan contoh arah, terutama:
  - header bulan benar-benar di tengah, dengan panah dekat namanya;
  - keadaan kosong yang rapi;
  - halaman Akun cukup untuk akun pembayaran;
  - recurring, cicilan dan langganan disederhanakan jadi satu tempat;
  - Sharing dibuat lebih mudah dipahami.

  Fitur baru yang besar, seperti Ledger Manager, **jangan dibangun**. Cukup catat sebagai usulan.
- **Screenshot:** `docs/design-review/Klunting/` (kondisi sekarang di HP), `docs/design-review/Budget/*` dan `docs/design-review/Lunch Money/` (referensi pola). Tiru pola interaksi dan kerapian, **bukan** logo, ikon, ilustrasi atau warna merek mereka.
- **Token Klunting:** `src/app/globals.css`, font Geist, angka tabular.

## Langkah

1. **Audit visual cepat.** Telusuri halaman utama di HP dan desktop memakai mode demo atau render lokal: Beranda, Transaksi, Anggaran, Akun, Kekayaan/Investasi, Langganan/Recurring, Profil, Landing dan Login. Catat masalah konkret, misalnya tidak sejajar, ukuran teks ad-hoc, radius/shadow tidak seragam, kontras gagal, keadaan kosong jelek, kepadatan berantakan, atau elemen berbau AI slop.
2. **Rencana satu halaman.** Tulis di `docs/REDESIGN_BUDGETAPP_PLAN.md`: 10 perbaikan teratas yang diurutkan menurut dampak per usaha, plus daftar usulan besar yang sengaja tidak dikerjakan. Push. **Tidak perlu menunggu persetujuan**; langsung lanjut ke langkah 3.
3. **Kerjakan perbaikan sesuai urutan,** satu commit kecil per perbaikan. Tiap kelompok perbaikan harus lolos `npm run build` + tes sebelum push, lalu Vercel membuat preview. Utamakan perbaikan sistemik dulu (skala tipografi, radius, border/kontras, keadaan kosong, header), baru perbaikan per halaman.
4. **Berhenti** setelah 10 perbaikan selesai, atau lebih awal kalau sisanya berisiko mengubah perilaku. Tulis bagian "Status" di rencana: apa yang berubah per halaman dan apa yang disarankan berikutnya.

## Aturan Desain (Wajib)

- **Arah:** premium, minimal, presisi ala Linear × Copilot Money. Mono dengan garis rambut 1px yang tegas, satu skala radius (12px, pill hanya untuk chip), satu skala tipografi (pakai kelas `.t-*` yang ada, kurangi `text-[Npx]` ad-hoc di halaman yang disentuh), angka tabular, spasi lega dan konsisten.
- **Warna hanya di data:** teal #17b890 positif, coral negatif. Teks memakai token `--c-mint-ink`/`--c-coral-ink` supaya kontras ≥ 4.5:1. Tombol dan kontrol mono.
- **DILARANG:**
  - serif atau italic dekoratif;
  - kartu dengan garis warna di atas;
  - grid kartu berikon;
  - gradien, glassmorphism, grain/noise;
  - emoji, maskot;
  - badge warna-warni berlebihan;
  - copy melodramatis atau yang mengasumsikan waktu/situasi pembaca;
  - spanduk peringatan besar.
- **Kontrak yang jangan diubah:**
  - angka di `src/lib/data/cashflow-forecast.ts` dan `src/lib/data/balances.ts`;
  - struktur Sankey hub (sumber kiri → Total Pemasukan → tujuan kanan);
  - Calm Mode (menyembunyikan untung dan rugi);
  - logo asli di `components/brand/klunting-logo`.
- **Desktop tetap utuh;** cek di lebar ≥ 1280px.
- **Aksesibilitas:** `<button>`/`<a>` asli, kontras teks ≥ 4.5:1, border kontrol ≥ 3:1, target sentuh ≥ 44px di HP.

## Selesai Berarti

Rencana dan status ter-push, setiap perbaikan lolos build/tes, dan ada ringkasan singkat untuk pemilik di bagian "Status". Pemilik akan menilai lewat preview Vercel branch ini.
