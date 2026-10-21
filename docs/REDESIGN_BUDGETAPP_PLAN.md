# Rencana Perbaikan Desain Klunting (branch `redesign/budget-app`)

Arah: premium, minimal, presisi ala Linear × Copilot Money. Mono + hairline 1px,
satu radius 12px (pill hanya chip), warna hanya di data (teal/coral). Audit dilakukan
pada render lokal mode demo (390px & 1280px) + screenshot `docs/design-review/Klunting/`.

## Temuan audit (ringkas)

- **Radius campur aduk:** kartu 16px, hero 22px, CTA 28px; `rounded-xl` = 22px dan
  `rounded-2xl` = 28px lewat token; tombol pill semua.
- **Ikon berwarna di mana-mana:** menu Lainnya (rotasi 4 tint), tile kategori Beranda
  (blok pastel + lingkaran ikon jenuh), kelas aset Investasi, KPI desktop.
- **Angka patah/terpotong:** tile kategori Beranda membungkus `Rp 18.500.0 / 00`;
  tile kelas aset Investasi memotong `Rp 15.036...`.
- **Gradien & glow:** hero Kekayaan/Akun/Aset/Profil/Kategori/Investasi pakai gradien
  + orb radial; kartu Keluarga/Lainnya/forecast/peringatan bunga pakai tint gradien;
  kartu kredit pakai gradien warna bank.
- **Hero Akun blok teal penuh** (warna di luar data). Label seksi (Akun/Kartu Kredit)
  berwarna.
- **Judul halaman salah:** Lainnya dan Profil menampilkan tagline
  "Klunting — Atur uang tanpa drama" sebagai judul.
- **Italic dekoratif + tint** di tesis riset saham; kotak disclaimer kuning besar.
- **Teks mikro 8–10px** (di bawah skala `.t-cap` 12px) tersebar; target sentuh ikon
  28px di header bulan & tombol hapus baris transaksi.
- Keadaan kosong tiap halaman beda-beda gaya.

## 10 perbaikan teratas (dampak ÷ usaha)

1. **Satu skala radius 12px** — token `--card-radius`, `--radius-*`, `--btn-radius`,
   `.btn-outline`; pill tinggal untuk chip. (sistemik)
2. **Ikon mono** — chip ikon netral (surface-2 + ink) di Lainnya, tile kategori Beranda,
   kelas aset Investasi, KPI desktop, sheet Tambah transaksi.
3. **Angka tidak boleh patah** — tile kategori Beranda & kelas aset Investasi pakai
   format ringkas + `whitespace-nowrap`.
4. **Hapus gradien & glow orb** — hero jadi flat `--hero-bg`; tint gradien kartu jadi
   surface polos; kartu kredit warna solid.
5. **Hero Akun mono + label seksi mono** — blok teal → hero gelap standar; label seksi
   pakai ink-soft, angka tetap berwarna data.
6. **Judul halaman benar** — Lainnya/Profil tidak lagi memakai tagline sebagai judul.
7. **Tanpa italic & spanduk** — tesis riset tegak tanpa tint; disclaimer kuning jadi
   caption abu kecil.
8. **Lantai tipografi 11px** — `text-[8–10.5px]` naik ke 11px (dan privacy-blur ikut);
   kurangi ukuran ad-hoc.
9. **Target sentuh 44px di HP** — tombol ikon header bulan, hapus baris transaksi,
   tombol ikon kecil `Button` di layar < 768px.
10. **Keadaan kosong seragam** — komponen `EmptyState` (ikon garis kecil, judul, 1 kalimat,
    1 tombol) dipakai di Berulang/Kontrak/Beranda.

## Usulan besar — sengaja TIDAK dikerjakan

- **Ledger Manager** (multi-buku ala Budget App) — fitur baru + skema.
- **Akun hanya untuk akun pembayaran** (RDN/RDI pindah ke Investasi) — mengubah
  agregasi saldo & liquid; butuh keputusan produk.
- **Sharing/Keluarga disederhanakan** jadi satu layar "apa yang dibagi" — perlu desain
  alur ulang, bukan restyle.
- **Hierarki & siklus anggaran** (pilih level kategori, siklus gajian) — logika data.
- **Sankey di Statistik Transaksi** — komponen ada di Laporan, tapi perlu agregasi baru.
- **Katalog provider langganan** (logo/preset) — aset & data baru.
- Penyatuan Berulang/Cicilan/Langganan sudah ada (tab di `/dashboard/recurring`);
  sisanya hanya polish.

## Status

Cakupan diganti `docs/REDESIGN_TOTAL_PROMPT.md` (redesign total, 5 fase). Dari
rencana 10 perbaikan, yang selesai dan jadi fondasi: #1 radius 12 + hairline,
#2 ikon mono, #3 angka tidak patah, #4 tanpa gradien/glow, #5 hero Akun & label
mono, #6 judul HP Lainnya/Profil. Sisanya (#7–#10) dilebur ke fase di bawah.

- **Fase 0 — bahasa desain:** `docs/DESIGN_LANGUAGE.md`; skala tipografi jadi
  token (`text-3xs…text-hero`, 1.044 `text-[Npx]` ad-hoc dipetakan, selisih
  ≤ 0.5px kecuali 9px→10px); CSS mati (`.glow-*`) dibuang; tab pill aktif di mode
  gelap tidak lagi putih-di-atas-putih; komponen `EmptyState` + `Skeleton`.
  Dibandingkan HP terang/gelap: kartu hairline + ikon mono lebih tenang dan
  hierarki angka lebih jelas. Screener tidak disentuh.
- **Fase 1 — shell:** bilah bawah HP dari dock gelap melayang → bilah docked
  mono (hairline, aktif = ink, tombol + primer 44px, ikut mode gelap);
  spinner "Memuat…" halaman diganti `PageSkeleton` (Beranda, Transaksi,
  Anggaran, Akun, Aset, Profil, Keluarga) + `dashboard/loading.tsx`; komponen
  `Segmented`; toggle Catatan|Statistik pindah ke baris aksi Transaksi (dulu
  melayang menutupi daftar), tombol ikon HP 44px. Mode demo: stub `rpc` supaya
  Anggaran tidak macet memuat. Desktop top-nav sudah satu area gulir — dibiarkan.
- **Fase 2 — halaman inti:**
  - *Beranda:* grafik hero tanpa area gradien; ikon widget Transaksi/Akun mono;
    kartu "Selangkah lagi" tidak lagi blok abu; kartu Anggaran 2 kolom (menutup
    lubang grid bento di 1440); select periode pakai border kontrol; HP: keadaan
    kosong pakai `EmptyState`, chevron/profil mono.
  - *Transaksi:* tipe di tabel desktop = titik kecil + teks (bukan badge
    warna-warni); ikon kategori & penanda "Pecahan" mono; pemilih tipe di dialog
    aktif = tombol primer; hapus baris HP target 44px; label donat Statistik
    tidak terpotong.
  - *Anggaran:* toggle Rencana|Sisa inline (bukan melayang), panah bulan 44px,
    "Kelola Kategori" jadi outline; donat pakai palet seri berurutan (dulu
    semua coral), legend titik, %/per-hari tanpa desimal; grid desktop tanpa
    latar tint per seksi; kartu ringkasan & catatan alokasi mono.
  - *Akun:* sudah dirapikan di fondasi (hero mono). **Dilewati:** "hanya akun
    pembayaran" di desktop — RDN saat ini hanya bisa dikelola dari halaman Akun
    (tautan "Kelola" di Investasi mengarah ke sana); memindahkannya = keputusan
    produk.
  - Mode demo kini memuat Anggaran (sebelumnya macet karena mock tanpa `rpc`).
