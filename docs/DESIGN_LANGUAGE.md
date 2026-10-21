# Bahasa Desain Klunting

"Presisi yang hidup": hening, garis rambut tegas, angka besar tabular sebagai
momen, spasi lega. Warna hanya bercerita tentang data. Sumber kebenaran:
`src/app/globals.css` (token) + `src/components/ui/*` (komponen).

## Tipografi

Geist, angka selalu `.num` (tabular). Satu skala; jangan `text-[Npx]` baru.

| Token (Tailwind) | px | Pakai untuk |
|---|---|---|
| `text-3xs` | 10 | label data rapat: sumbu grafik, sel kalender |
| `text-2xs` | 11 | eyebrow (uppercase, tracking 0.12em), caption kecil |
| `text-cap` | 12 | meta baris, helper |
| `text-ui` | 13 | label kontrol, isi tabel |
| `text-body` | 14 | teks isi |
| `text-row` | 15 | judul baris list di HP |
| `text-lead` | 16 | judul kartu |
| `text-h3/h2/h1` | 18/20/22 | judul seksi/halaman |
| `text-hero` | 28 | angka momen (HP); desktop boleh `.t-display` (clamp 28–36) |

Berat: 400 isi, 500 label, 600 judul/angka. Tanpa serif, tanpa italic.
Kelas `.t-display/.t-h1/.t-h2/.t-title/.t-body/.t-sm/.t-cap` tetap ada sebagai
paket ukuran + berat + line-height.

## Spasi & grid

Kelipatan 4 (4/8/12/16/20/24/32). Padding kartu 16 (HP) / 20 (desktop).
Jarak antar-kartu 12 (HP) / 16 (desktop). Baris list min 52px.

## Radius

Satu radius **12px** untuk kartu, tile, tombol, input, dialog (`rounded-lg/xl/2xl/3xl`
semuanya 12). 8px hanya untuk elemen kecil di dalam kartu (badge, swatch, chip ikon).
Pill (`rounded-full`) hanya untuk chip filter, avatar, toggle.

## Elevasi

Datar. Kartu = `--surface` + garis rambut 1px `--outline`, tanpa bayangan
(HP) / bayangan 1px nyaris tak terlihat (desktop). Bayangan nyata hanya untuk
lapisan yang melayang: dialog, sheet, popover, bilah bawah.

## Warna

- **UI mono.** Tinta `--ink` (konten), `--ink-muted` (sekunder), `--ink-soft`
  (label). Tombol primer = `--c-primary` (hitam di terang, putih di gelap).
- **Warna hanya di data.** Positif teal `--c-mint`, negatif coral `--c-coral`.
  Teks berwarna wajib versi `-ink` (≥ 4.5:1). Biru/ungu logo hanya untuk seri
  grafik dan kategori data, bukan untuk chrome, ikon menu, atau eyebrow.
- Amber hanya status "mendekati batas".
- Border kontrol (input, select, tombol outline) `--input-border` (≥ 3:1).

## Komponen inti

- **Tombol:** primer (isi ink), outline (border kontrol), ghost. Tinggi 36
  desktop; target sentuh ≥ 44 di HP. Ikon 16px.
- **Input/select:** tinggi 36, radius 12, border kontrol, fokus = ring ink.
- **Tabel:** header `text-2xs` uppercase ink-soft, baris hairline, angka rata kanan.
- **Angka besar:** `.num` 600, tracking -0.02em; sub-angka ink-muted.
- **Kartu:** `.s-card` (+ `.s-card-pad*`). Tanpa garis warna di atas, tanpa tint.
- **Chip:** pill 22–28px, netral `surface-2`; data chip boleh mint/coral soft.
- **Tab/segmented:** pill netral, aktif = isi `--c-primary`.
- **Dialog/sheet:** radius 12 (sheet HP: radius atas saja), bayangan lapis.
- **Empty state:** `<EmptyState>` — ikon garis 20px dalam lingkaran surface-2,
  judul 14/600, satu kalimat ink-muted, maksimal satu tombol. Jangan angka 0 palsu.
- **Skeleton:** `<Skeleton>` blok `surface-2` berdenyut, bentuk mengikuti konten.
- **Grafik:** garis 1.5–2px, tanpa area gradien, grid hairline, sumbu `text-3xs`
  ink-soft, tooltip kartu kecil. Seri: teal, coral, biru, ungu, lalu abu.

## Navigasi

- **Desktop (≥ 768):** top-nav satu baris (logo, menu utama, cari ⌘K, profil);
  konten max-w 1280, satu area gulir (halaman), tanpa gulir bersarang.
- **HP:** app bar (judul center, back kiri, aksi kanan) + bilah bawah 5 slot
  (Beranda, Transaksi, +, Anggaran, Lainnya). Pemilih periode di tengah,
  panah tepat di samping nama bulan.

## Mode gelap

Kanvas `#0F0F14`, kartu `#19191F`, hairline putih 10%. Tombol primer jadi
terang dengan teks gelap (`--c-primary-foreground`) — jangan hard-code `#fff`
di atas `--c-primary`. Warna data pakai varian yang sama; cek setiap fase.
