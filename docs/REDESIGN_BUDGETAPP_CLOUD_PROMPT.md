# Instruksi Sesi Cloud: Redesign Klunting Mengikuti Review "Budget App"

Kerjakan di branch `redesign/budget-app`. Jangan merge ke `master`, jangan deploy produksi, dan jangan terapkan migrasi ke Supabase. Kalau butuh skema baru, tulis berkas SQL di `supabase/migrations/` saja dan tandai "BELUM DITERAPKAN". Bekerja hemat token.

## Bahan

- **Review pemilik:** `docs/design-review/Budget/DESIGN_REVIEW.md`. Teks dan 29 gambarnya disusun berurutan, dan gambar mengikuti catatannya. Ini sumber kebenaran.
- **Screenshot per bagian:**
  - `docs/design-review/Budget/<Home|Transactions|Budget|Account|Sharing Manager|Ledger Manager|Recurring, Installment, Subscription|Pilih Tema|Lain-Lain>/`: referensi Budget App;
  - `docs/design-review/Klunting/`: tampilan Klunting sekarang, HP;
  - `docs/design-review/Lunch Money/`: referensi tambahan.
- **Arah desain Klunting yang berlaku:** `src/app/globals.css` (token), font Geist, angka tabular.

## Fase 0: Rencana Dulu, Tanpa Kode

Tulis `docs/REDESIGN_BUDGETAPP_PLAN.md`. Untuk setiap bagian review (Home, Transactions, Budget, Account, Sharing Manager, Ledger Manager, Recurring/Installment/Subscription, Pilih Tema, Lain-Lain), isinya:

1. Ringkasan permintaan pemilik dengan kata-katanya sendiri.
2. Kondisi Klunting sekarang (berkas/komponen terkait).
3. Usulan perubahan konkret: layout, interaksi, dan keadaan kosong.
4. Perubahan data atau skema bila ada. Ledger Manager kemungkinan butuh tabel baru; sebutkan SQL-nya dan dampaknya ke RLS.
5. Perkiraan ukuran (S/M/L) dan urutan pengerjaan.

Akhiri dengan daftar pertanyaan yang benar-benar perlu dijawab pemilik. **Setelah rencana di-commit dan di-push, BERHENTI dan tunggu persetujuan pemilik di sesi ini.** Jangan menulis kode sebelum disetujui.

## Fase 1 dan Seterusnya (Setelah Disetujui)

- Kerjakan per bagian, sesuai urutan yang disetujui. Commit kecil per bagian, dan `npm run build` + tes lulus sebelum push. Vercel membuat preview untuk direview pemilik.
- **"Tiru, amati, modifikasi":** tiru pola interaksi dan struktur, tapi pakai identitas Klunting. Jangan menyalin logo, ikon, ilustrasi atau warna merek Budget App.
- **Fokus utama mobile** (screenshot review adalah HP). Desktop tidak boleh rusak; cek di lebar ≥ 1280px.
- Jangan ubah kontrak angka yang sudah ada:
  - `src/lib/data/cashflow-forecast.ts`;
  - perhitungan saldo di `src/lib/data/balances.ts`;
  - struktur Sankey hub (sumber kiri → Total Pemasukan → tujuan kanan; keputusan final pemilik).

  Sankey di halaman Transaksi memakai komponen yang sudah ada.

## Aturan Desain (Wajib)

- **Arah:** premium, minimal, presisi; mono dengan garis rambut 1px, radius 12px, angka tabular. Warna hanya di data: teal #17b890 positif, coral untuk negatif (pakai token `--c-mint-ink`/`--c-coral-ink` untuk teks supaya kontras ≥ 4.5:1).
- **DILARANG:**
  - serif atau italic dekoratif;
  - kartu dengan garis warna di atas;
  - grid kartu berikon;
  - gradien, glassmorphism, emoji;
  - maskot;
  - copy melodramatis, atau yang mengasumsikan waktu atau situasi pembaca.
- **Header Home:** nama bulan benar-benar di tengah, panah dekat dengan nama bulan, dan pemilih ledger di pojok kiri (sesuai review).
- **Keadaan kosong:** semua halaman yang disebut review punya tampilan kosong yang rapi.
- **Aksesibilitas:** `<button>`/`<a>` asli, target sentuh ≥ 44px.

## Selesai Berarti

- Fase 0: rencana ter-push, sesi berhenti menunggu.
- Fase berikutnya: tiap bagian ter-push dan lolos build/tes, dengan status ditulis di bagian "Status" rencana.
