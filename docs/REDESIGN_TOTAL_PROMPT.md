# Instruksi Lanjutan: Redesign TOTAL Klunting (Desktop + HP)

Ini menggantikan cakupan di `REDESIGN_BUDGETAPP_CLOUD_PROMPT.md`. Pemilik ingin **redesign total seluruh web**: aplikasi desktop dan HP, plus halaman publik. Bukan hanya pola Budget App di HP. Perbaikan yang sudah kamu kerjakan dari rencana 10 perbaikan tetap dipakai sebagai bagian dari fondasi.

Kerjakan di branch `redesign/budget-app` (`git pull` dulu). Jangan merge ke `master`, jangan deploy produksi, jangan terapkan migrasi. Jangan ubah halaman `/dashboard/screener` dan `src/lib/invest/screener*`, karena sedang dirombak di branch `feat/screener-v2`. Cukup pastikan shell dan token baru berlaku juga untuknya. Bekerja hemat token: perbaikan sistemik dulu, baru per halaman.

## Tujuan

Seluruh Klunting terasa **premium, rapi, minimal, hidup, dan jelas bukan AI slop**, sebagai satu bahasa desain yang konsisten di desktop (1280–1440px) dan HP (390px), terang dan gelap. Kamu bebas merancang layout. Pemilik menilai hasilnya lewat preview Vercel per fase.

## Fase (Push di Akhir Tiap Fase, Lalu Lanjut Otomatis)

0. **Bahasa desain.** Tulis `docs/DESIGN_LANGUAGE.md` (maksimal 2 halaman). Isinya:
   - skala tipografi;
   - spasi (grid 4/8);
   - satu skala radius;
   - elevasi atau garis rambut;
   - aturan warna: mono + warna hanya di data;
   - komponen inti: tombol, input, select, tabel, stat/angka besar, kartu, chip, tab/segmented, dialog/sheet, empty state, skeleton loading, gaya grafik;
   - navigasi desktop dan HP;
   - mode gelap.

   Terapkan di `src/app/globals.css` dan `src/components/ui/*`. Ganti ukuran teks ad-hoc dengan skala, buang CSS mati, dan pastikan border kontrol berkontras ≥ 3:1.
1. **Shell aplikasi.**
   - Navigasi desktop: manfaatkan lebar layar, dengan satu area gulir tanpa gulir bersarang.
   - Navigasi HP: bilah bawah dan header.
   - Pola header halaman: judul, aksi, dan pemilih periode di tengah dengan panah dekat.
   - `loading.tsx` dan skeleton.
   - Keadaan kosong dan error yang rapi, bukan angka 0 palsu.
2. **Halaman inti:** Beranda, Transaksi (Record/Stats + Sankey yang sudah ada), Anggaran, dan Akun (hanya akun pembayaran; investasi di halamannya sendiri).
3. **Kekayaan:** Net worth, Aset likuid dan non-likuid (termasuk peta), Investasi + riset saham, Utang, Kartu kredit, Dana darurat, Goals.
4. **Sisanya:** Recurring/Cicilan/Langganan (disederhanakan jadi satu tempat), Laporan bulanan dan print, Kalkulator, Playbook, Keluarga/Sharing (disederhanakan), Profil/Pengaturan/Tampilan, Pricing.
5. **Halaman publik:** Landing, Features, Login/Daftar, Onboarding, About/Contact/Legal.
   - Aturan copy landing yang tertulis di header `src/app/page.tsx` tetap berlaku: tanpa asumsi waktu atau situasi pembaca, tanpa melodrama, klaim = fakta produk.
   - Pakai logo asli `components/brand/klunting-logo`.

Di akhir tiap fase:
- build + tes lulus;
- commit kecil dan push;
- satu baris status di `docs/REDESIGN_BUDGETAPP_PLAN.md` bagian "Status" (fase, halaman yang berubah, catatan).

Lalu lanjut ke fase berikutnya. Kalau sebuah perubahan berisiko mengubah perilaku atau angka, laporkan dan lewati.

## Arah dan Pagar

- **Arah:** presisi ala Linear × Copilot Money × Arc, yaitu "presisi yang hidup". Rasa mahal datang dari keheningan, garis rambut tegas, angka besar tabular sebagai momen, dan spasi lega. Rasa muda datang dari palet logo 4 warna (teal #17b890, coral #f0664f, biru #5d6fe0, ungu #8b4fb0) sebagai aksen data dan grafik, plus micro-interaction halus.
- **Referensi pola (bukan merek):** `docs/design-review/` (Budget App, Lunch Money, screenshot Klunting sekarang). Tiru pola dan kerapiannya, jangan salin logo, ikon atau warnanya.
- **DILARANG:**
  - serif atau italic dekoratif;
  - kartu dengan garis warna di atas;
  - grid kartu berikon;
  - gradien hiasan, glassmorphism, grain/noise;
  - emoji, maskot;
  - badge warna-warni;
  - spanduk peringatan besar;
  - copy melodramatis;
  - daur ulang gambar lama bila diminta "total".
- **Kontrak yang tidak boleh berubah:**
  - angka di `src/lib/data/cashflow-forecast.ts`, `balances.ts`, dan fungsi net worth;
  - struktur Sankey hub (sumber kiri → Total Pemasukan → tujuan kanan);
  - Calm Mode (menyembunyikan untung dan rugi);
  - gating paket/billing;
  - privasi Sentry.
- **Aksesibilitas:**
  - `<button>`/`<a>` asli;
  - kontras teks ≥ 4.5:1 dan kontrol ≥ 3:1;
  - target sentuh ≥ 44px di HP;
  - fokus keyboard terlihat;
  - ⌘K tetap jalan.
- **Mode gelap** harus tetap sekuat sekarang. Cek setiap fase di terang dan gelap.

## Selesai Berarti

Kelima fase ter-push dengan status masing-masing. Kalau sesi harus berhenti lebih awal, fase yang sudah ter-push tetap utuh dan bisa dipakai, karena tiap fase berdiri sendiri.
