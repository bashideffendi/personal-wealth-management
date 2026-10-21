# Instruksi Sesi Cloud: Screener IDX v2

Kerjakan di branch `feat/screener-v2` (sudah berisi data dan rencana). Jangan merge ke `master`, jangan deploy ke produksi, jangan sentuh Supabase atau migrasi. Bekerja hemat: baca hanya berkas yang perlu, tanpa eksplorasi luas.

## Bahan

- Rencana dan keputusan yang sudah disetujui pemilik: `docs/SCREENER_V2_PLAN.md`. Ikuti persis.
- Data: `src/data/invest/screener-v2.json`.
  - 967 baris; `hasScore` = true untuk 161 (149 non-keuangan `group: "non_financial"`, 12 bank `group: "bank"`).
  - Field per baris: ticker, name, sector, subSector, shariah, price, mcap, liq60, chg1y, per, pbv, evEbitda, roe, divYield, specialBoard, hasScore, score{composite,value,prof,safety} (persentil 0–1), valuation{cons,base,opt (per lembar), status reliable|unreliable|not_valued|bank_pb, gap, pbJustified, pbMarket}, flags{mrs,up,eqFlag,hsc}, modelClass{code,label,note}.
  - Meta: label, disclaimer, marketAsOf, scoresAsOf.
- Kode lama:
  - `src/app/dashboard/screener/page.tsx`
  - `src/app/api/screener/route.ts`: ganti sumbernya ke `screener-v2.json`, cache module-level; daftarkan di `outputFileTracingIncludes` bila masih fs-read.
  - `src/lib/invest/*`
  - Akses paket di `src/components/pricing/plans.ts`: pertahankan.

## Yang Dibangun

1. **API** `/api/screener`: kembalikan baris v2 dan meta. Hapus nilai wajar konsensus Excel dan verdict lama.
2. **Halaman `/dashboard/screener`:**
   - Satu tabel padat dengan header lengket, baris 40px dan garis rambut 1px, angka rata kanan tabular. Satu area gulir, tanpa gulir bersarang; tabel lebar boleh gulir horizontal di dalam kotaknya.
   - Kontrol bersegmen set kolom: **Ringkas** (ticker+nama, sektor, harga, kapitalisasi, skor gabungan) · **Valuasi** (PER, PBV, EV/EBITDA, yield, nilai wajar dasar, selisih) · **Kualitas** (Nilai, Profitabilitas, Keamanan, ROE) · **Risiko** (likuiditas 60 hari, MRS, UP, penanda kualitas laba, papan pemantauan khusus, syariah).
   - Persentil = meter 2px + angka. Teal (#17b890) hanya bila ≥ 0,80; selebihnya abu (`--ink-faint`).
   - Filter sebaris:
     - preset "Punya skor" (aktif default), "Kualitas tinggi" (prof ≥ 0,8 dan safety ≥ 0,6), "Murah vs sektor" (value ≥ 0,8), "Likuid" (liq60 ≥ Rp10 miliar), "Syariah";
     - chip sektor dan pencarian ticker/nama;
     - satu popover "Lanjutan" untuk rentang PER/PBV/ROE/yield.
   - Sort per kolom dengan klik header. Ekspor CSV tetap ada.
   - Klik baris membuka **panel samping kanan** (sheet bawah di mobile), bukan modal:
     - nama + ticker + sektor;
     - meter tiga persentil;
     - batang rentang nilai wajar konservatif–dasar–optimistis dengan penanda harga sekarang. Hanya bila status `reliable`; bila `unreliable` tulis "Valuasi belum andal", bila `not_valued` tulis "Riwayat laba belum cukup", bank tampilkan P/B wajar vs pasar;
     - penanda risiko sebagai daftar teks pendek;
     - kelas model kecil di bawah: label + "kelas model riset, belum tervalidasi";
     - tautan ke halaman riset yang sudah ada (`/dashboard/assets/investment/stock/research/[ticker]`);
     - tanggal data.
   - Header halaman: judul "Screener IDX", lalu satu baris tenang berisi disclaimer + "Data pasar 16 Okt 2026 · Skor riset 30 Sep 2026", diambil dari meta, bukan hardcode.
   - Nilai ekstrem dibatasi tampilannya, misalnya PER > 100 tampil "> 100". Nilai kosong tampil "–".
3. **Tes**: unit test untuk fungsi filter, sort, preset dan format angka, mengikuti pola tes yang ada.

## Aturan Desain (Wajib)

- **Arah:** premium, minimal, presisi ala Linear × Copilot Money. Token yang sudah ada di `globals.css`: `--bg`, `--surface`, `--ink`, `--ink-muted`, `--ink-soft`, `--text-faint`, `--border`, `--accent`. Font Geist dengan `font-variant-numeric: tabular-nums`. Radius 12px, garis rambut 1px.
- **Warna hanya di data:** teal untuk positif/persentil tinggi, coral (#f0664f) untuk negatif. Tombol dan kontrol mono (ink).
- **DILARANG:**
  - serif atau italic dekoratif;
  - kartu dengan garis warna di atas;
  - grid kartu berikon;
  - gradien, glassmorphism, emoji;
  - badge verdict warna-warni;
  - angka "potensi naik X%" yang dibesarkan;
  - spanduk peringatan besar;
  - slider rentang yang selalu terbuka.
- **Aksesibilitas:** elemen interaktif berupa `<button>`/`<a>`, kontras teks ≥ 4.5:1, target sentuh ≥ 44px di mobile.
- **Ikuti pola komponen yang ada** (shadcn/ui, `PageHeader`, `StatStrip`) bila cocok. Jangan membuat sistem desain baru.

## Selesai Berarti

- `npm run build` dan tes lulus.
- Commit kecil-kecil di `feat/screener-v2`, lalu push. Vercel membuat preview, dan pemilik yang menilai.
- Tulis ringkasan singkat di `docs/SCREENER_V2_PLAN.md` bagian baru "Status build": apa yang dibuat, apa yang belum, dan tautan preview kalau terlihat.
