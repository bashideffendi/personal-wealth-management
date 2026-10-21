# Rencana Screener IDX v2

Draf 21 Okt 2026, menunggu persetujuan. Belum ada kode yang ditulis.

## Masalah Screener Sekarang

Screener sekarang (`/dashboard/screener`, `/api/screener`) punya 12 kolom yang dihitung dari file per-ticker. Nilai wajarnya diambil dari Excel konsensus April, jadi sudah basi, dan Margin of Safety bisa jadi absurd (KBLV +1.388%). Tidak ada ukuran kualitas atau risiko. Verdict "Undervalued/Overvalued" ikut terdengar seperti saran. Layoutnya tabel generik dengan slider rentang.

## Isi Baru

Sumbernya dua, keduanya diekspor lokal tiap bulan setelah langkah bulanan IDX Screener:

1. **Data pasar dan fundamental semua emiten tercatat (±950).** Isinya harga, kapitalisasi pasar, likuiditas harian (median 60 hari), PER, PBV, EV/EBITDA, ROE, dividend yield, sektor dan sub-sektor, serta status syariah. Datanya dari scrape Stockbit Okt 2026, yang sudah ada di branch `data/stockbit-okt-2026`.
2. **Skor model riset untuk semesta yang eligible (±150 non-keuangan + 12 bank).** Isinya:
   - **Persentil sektor:** Nilai (VALUE), Profitabilitas (PROF), Keamanan (SAFETY) dan skor gabungan.
   - **Nilai wajar residual income v1.9:** rentang konservatif–dasar–optimistis, selisih terhadap harga, dan status valuasi (andal / tidak andal / belum bisa dinilai).
   - **Penanda risiko:** skor manipulasi (MRS), skor ketidakpastian (UP), penanda kualitas laba, papan pemantauan khusus, dan konsentrasi kepemilikan.

Nilai wajar konsensus Excel dan verdict lama dihapus. Margin of Safety diganti selisih terhadap nilai wajar model, dan selalu ditampilkan bersama rentang serta statusnya. Kalau status tidak andal, angkanya tidak ditampilkan.

## Tampilan (Premium, Minimal, Bukan AI Slop)

Mengikuti arah desain Juli: presisi ala Linear × Copilot Money, mono, garis rambut 1px, radius 12px, angka tabular, warna hanya di data, tanpa serif.

- **Satu tabel padat sebagai pusat.** Header lengket, baris setinggi 40px dengan garis rambut, angka rata kanan tabular, satu area gulir (tanpa gulir bersarang).
- **Set kolom lewat kontrol bersegmen di atas tabel:** Ringkas · Valuasi · Kualitas · Risiko. Kontrol ini menggantikan 12 kolom sekaligus.
- **Persentil ditampilkan sebagai meter tipis 2px + angka.** Bukan badge berwarna. Teal hanya untuk persentil ≥ 80, selebihnya abu.
- **Filter sebaris:**
  - preset cepat "Kualitas tinggi", "Murah vs sektor", "Likuid", "Syariah";
  - chip sektor;
  - satu popover "Lanjutan" untuk rentang angka.

  Slider rentang yang selalu terbuka dihapus.
- **Klik baris membuka panel samping kanan, bukan modal:**
  - meter tiga persentil;
  - batang rentang nilai wajar (konservatif–dasar–optimistis) dengan penanda harga;
  - daftar penanda risiko dalam teks pendek;
  - tanggal data dan tautan ke halaman riset per saham yang sudah ada.
- **Label jujur di header, satu baris tenang:** "Skor riset, belum tervalidasi. Bukan saran investasi. Data per 30 Sep 2026." Tidak ada spanduk peringatan besar.
- **Dilarang:**
  - kartu dengan garis warna di atas, grid kartu ikon, gradien, glass, emoji;
  - verdict berwarna-warni;
  - angka "potensi naik X%" yang dibesarkan sebagai klaim.
- **Mobile:** kolom diprioritaskan (ticker, harga, skor gabungan, satu kolom set aktif), dan panel samping menjadi sheet bawah.

## Data dan Alur

1. **IDX Screener:** skrip baru `scripts/export_klunting.py` menulis satu berkas `src/data/invest/screener-v2.json` (±1 MB). Isinya per ticker: kolom pasar, skor, valuasi, penanda, `as_of`, `model_version`, `label: "NOT YET VALID"`.
2. **Klunting:** `/api/screener` membaca berkas itu (statis, dicache), dan fs-read per-ticker yang mahal dihapus.
3. **Pembaruan:** tiap bulan setelah langkah resmi IDX Screener, ekspor ulang lalu commit ke branch dan preview Vercel. Produksi hanya setelah kamu setuju.

## Urutan Kerja dan Biaya

1. **Lokal, sesi ini:**
   - QA dan merge branch data Okt;
   - tulis `export_klunting.py`;
   - ekspor dari dry run 30 Sep (data akan diganti hasil resmi 30 Okt);
   - buat branch `feat/screener-v2` berisi data dan rencana.
2. **Mockup satu layar (HTML statis) untuk kamu setujui:** tabel, filter, dan panel samping dengan data asli.
3. **Sesi cloud, setelah mockup disetujui:** bangun halaman, API dan panel sesuai mockup, plus tes, lalu push branch untuk preview Vercel. Perkiraan biaya sekitar US$20–60 dari kredit US$250.
4. **Review:** kamu menilai preview, revisi bila perlu, lalu merge.

## Keputusan (Disetujui 21 Okt 2026)

1. **Kelas model hanya di panel samping**, kecil, berlabel "kelas model riset, belum tervalidasi". Tabel hanya memuat skor faktual dan penanda.
2. **Cakupan semua ±950 emiten**, dengan filter bawaan "punya skor".
3. **Branch data Okt di-QA lalu digabung lebih dulu** ke branch screener. Produksi menunggu persetujuan atas preview.
4. **Akses paket** tetap seperti sekarang.
