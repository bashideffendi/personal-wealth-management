# Klunting — Rencana Redesign App (Mobile-First)

> Status: **plan terkunci** (14 Jun 2026), implementasi belum mulai. Disusun setelah studi semua screenshot + riset web multi-sumber (workflow 8-agen) + grounding codebase. Dasar keputusan: Claude (lead designer) decide; user validasi tiap fase via try-on.
> Repo: `D:\Claude-Projects\2. Finance and Investment\Klunting` · remote `github.com/bashideffendi/personal-wealth-management` · Next 16.2.6 · Tailwind v4 + shadcn · recharts 3.8.1 · next/font.

---

## 0. North star
**Dua permukaan, satu sistem.**
- **Beranda = "muka jualan"** — lega, branded, hero net-worth + sparkline + KPI tile + donut/ring berwarna. Screenshot-able buat marketing.
- **Layar kerja** (Transaksi/Investasi/Kekayaan/Laporan/Anggaran) = **density Stockbit** — baris ~44-52px, hairline, angka tabular kanan, ~10-11 item/layar, near-monokrom (warna cuma di nilai/kategori).
- **Pemersatu:** hierarki dari **WEIGHT + WARNA + POSISI, bukan SIZE.** Ini akar-fix dari bloat 28-40px yang ngalahin logo.

## 1. Prinsip (dari riset + screenshot)
1. **Proporsi disiplin** — 1 angka hero/layar (≈ tinggi-huruf logo), sisanya kecil. Stockbit: harga ~17px, nama ~14px; nol angka raksasa.
2. **Nol overflow** — semua dibentuk ulang buat 390px, bukan dikecilin. Tabel→kartu/accordion; tab→pill scrollable; Sankey→2-kolom cap-node.
3. **Warna = data, bukan dekorasi** — 60-30-10; brand color ≤15% chrome; netral dominan.
4. **Satu nav di mobile** — buang top-nav desktop; cuma bottom-tab + header tipis kontekstual.
5. **App-native** — PWA standalone, safe-area, bottom-sheet, swipe, no double-chrome.
6. **Sankey: keep & bangun bener** (bukan dibuang) — resep Stockbit (§7).

---

## 2. Foundation — Tipografi
Font: **Plus Jakarta Sans** (brand; via `next/font/google`, weights 400/500/600/700/800). Drop serif Instrument di mobile. `.num{ font-variant-numeric: lining-nums tabular-nums }`.

| Tier | px / weight | Pakai |
|---|---|---|
| Hero | 28-30 / 700-800 | **SATU** angka/layar (net worth, portfolio total). Di-cap ≤ tinggi-huruf wordmark logo. |
| Title | 20 / 600-700 | judul layar/section |
| Subtitle | 17 / 600 | header kartu, saldo sekunder |
| Body | 15 / 400-500 | teks + nilai baris (input 16 anti-zoom iOS) |
| Label | 13 / 500 | nilai sekunder, unit, label chart/sankey, header tabel |
| Micro | 11-12 / 500 | tab-label, timestamp, tag |

Aturan angka: prefix "Rp" + trailing ".000" opacity ~60%; dense rows abbreviate (Rp 12,5 jt / Rp 1,2 M); full digit cuma di hero + detail.

## 3. Foundation — Warna (remap token di `globals.css`)
Strategi: **redefine NILAI token** (nama token tetap → komponen inherit otomatis). 4 hue brand = 1 peran tetap. Netral kerjain hierarki.

| Token | Lama (Cartoon Quest) | BARU (brand logo) | Peran |
|---|---|---|---|
| `--c-mint` | `#129B69` | **`#17b890`** teal | masuk/naik/positif (`--money-in`) |
| `--c-coral` | `#D2495A` | **`#f0664f`** coral | keluar/turun/danger (`--money-out`) |
| `--c-violet`| `#7C5FD3` | **`#8b4fb0`** ungu | langganan/kategori/AI |
| `--c-blue` (BARU) | — | **`#5d6fe0`** biru | info/akun/link (`--info`) |
| `--c-primary` | `#FFC83D` emas | **`#18181b`** ink | tombol/FAB/aksi (foreground `#fff`) |
| `--accent` (BARU) | — | **`#17b890`** teal | active-nav/link/aksen |
| `--c-amber` | `#C98F0E` | keep (retune halus) | warning anggaran near-limit |
| `--ink` | `#1E1B16` | `#18181b` | teks utama |
| ink ramp | — | `#18181b`/`#3f3f46`/`#71717a`/`#a1a1aa` | strong/body/muted/faint |
| `--paper`/`--bg` | `#FFF9EE` krem | **`#FAFAFA`** | kanvas (drop krem) |
| `--surface` | `#fff` | `#fff` | kartu |
| `--border` | `#D5C39D` tan | `rgba(24,24,27,0.08)` | hairline |
| `--hero-bg` | `#241F31` dusk | **`#0F0F14`→`#19191F`** charcoal | hero gelap |

**Drop dekorasi kartun:** `--card-shadow`/`--btn-shadow` offset → none (flat); `--outline-w` → 0.5-1px hairline; radius kartu 14-16, hero 18-20, pill 999. Default skin = brand baru (skin mono/terminal: keep sbg alternate atau pensiun — putuskan nanti). Dark mode = recalibrasi (aksen sedikit desaturasi), bukan inversi. **Palet kategori ORDERED tetap** (4 hue + tint, max ~8, ekor→"Lainnya") konsisten di donut/sankey/bar/list. Gain/loss SELALU = warna + tanda + ikon (WCAG AA 4.5:1).

## 4. Foundation — Spacing / elevation
Grid 4px. Padding kartu 14-16 · tinggi baris 44-52 (→ ~10-11/layar) · gap kartu 10-12 · margin section 16-20 · padding tepi 14-16 · tap-target min 44. Flat: hairline 0.5px, no heavy shadow (shadow fungsional fokus-ring only).

---

## 5. Migrasi token — pendekatan & guardrail
1. **Branch terpisah** (`redesign/mobile`) — live klunting.com gak keganggu sampai di-ACC.
2. Remap `:root` (+ blok skin default + `.dark`) di `globals.css` per tabel §3. Tambah `--c-blue`/`--accent`/ink-ramp.
3. **Audit hex hardcoded** (`grep` literal `#`, `var(--c-amber)` di teks, dll) — yang nembus token, geser ke token. (Memory: ada literal di Satori og/email/Sigma/CATEGORY_COLORS DB — pisahkan, jangan paksa token.)
4. **Cek paritas desktop** — `npm run build` + lihat beberapa halaman desktop gak pecah (token dipakai web juga).
5. Swap font di `layout.tsx` (Instrument → Plus Jakarta via next/font).

## 6. Komponen inti (bikin/refactor di `src/components/`)
- `AppHeader` — slim sticky, judul/back + max 2 aksi; **hapus top-nav di `<md`** (`hidden md:flex` di nav desktop existing).
- `BottomTabBar` — refactor existing: 4-5 dest (Beranda/Transaksi/Investasi/Kekayaan/Lainnya), ~56px, icon 24, label 11-12, `env(safe-area-inset-bottom)`, active=`--accent`.
- `FabAdd` — ink, clearing tab+home-indicator.
- `ListRow` — primitive padat 44-52px, hairline, label kiri/nilai kanan tabular; varian swipe (edit/hapus + Undo) + menu "…".
- `MoneyText` — tabular, warna otomatis (in/out), prefix/trailing redup, mode hide-balance.
- `SegmentedTabs` — pill scrollable + scroll-snap + edge-fade (anti-overflow); active=accent.
- `StatTile` · `ProgressBar` · `Donut`/`Ring`/`Sparkline`/`MiniBars` (wrapper recharts) · `BottomSheet` (handle+X+scrim, ganti dialog tengah).
- Global CSS shell: `overscroll-behavior-y:contain`, `-webkit-tap-highlight-color:transparent`, user-select scoped (saldo tetap selectable).

## 7. Sankey — spec detail (resep Stockbit, recharts `<Sankey>` / d3-sankey)
Layar **Aliran Uang** punya Sankey beneran; dashboard cuma kartu ringkas yang nge-tap buka ini.
- **2 kolom** (Pemasukan → kategori), bukan 4-5.
- **Node = bar tipis** (~8-10px) di tepi; pita aliran dapat ~90% lebar.
- **Label ringkas ditempel di pita/tepi** (nama pendek + "Rp nilai"), bukan label ngambang → **nol truncation**.
- **Cap top 6-7 + "Lainnya"** (atau grup: Investasi/Kebutuhan/Gaya hidup/Belum-dipakai).
- **Warna by grup** (4 hue), pita kecil abu.
- **Tipe 13-14px**, nol angka raksasa.
- **Interaksi**: tap node → drill rincian kategori; pinch-zoom; landscape buat lebih lega; tombol **Bagikan** (share-as-image, opsi hide-amount).
- Toggle **"Rincian"** = list inline-bar (buat yang prefer list).
- recharts `<Sankey>` cukup; kalau routing pita kurang presisi, pakai `d3-sankey` (tambah dep).

## 8. Per-layar (current → target)
- **Beranda** (jualan): hero net-worth (1 angka 28-30 + sparkline + delta sign+arrow + eye hide-balance) → 2-3 KPI tile (cash/spend-vs-budget/skor-sehat, ada mini-viz) → strip "yang berubah/hari ini" → donut alokasi (4 warna) → goal ring → 5 transaksi terbaru. Kartu reorderable (existing). Insight 1-baris bahasa santai.
- **Transaksi** (kerja): list primitive padat, dikelompokin per tanggal (human date), swipe + "…"; filter di bottom-sheet; buang link "Ubah/Hapus" per-baris. ~10-11/layar.
- **Anggaran**: ring total + list kategori inline-bar (hijau aman / amber mepet / coral lewat) + ikon. Buang pola "label+kotak nominal" datar.
- **Investasi**: hero portfolio (1 angka) + `SegmentedTabs` scrollable (Posisi/Watchlist/Research/Banding/Dividen — **fix "Compare/Laporan" ke-potong**) → holding list padat (ticker+nama+nilai+P/L% warna+lot). Tabel rasio: 2-line card < 480px atau sticky header+kolom-1. Tap holding → detail. Jangan tampilin rugi tanpa konteks/benchmark.
- **Aliran Uang**: §7.
- **Kekayaan**: 1 angka hero + breakdown asset-class accordion + bar; line chart net-worth scrubber on-tap.
- **Research AI**: tabel lebar → pola mobile (2-line/stacked atau scroll sticky); narasi tetap (konten kuat). 52-wk slider + ratio list udah oke (re-token).
- **Profil/Lainnya · Auth/Onboarding**: header tipis; empty-state = skeleton + 1 CTA (bukan kartu kosong); onboarding = momen brand 4-warna boleh main.

## 9. PWA shell
`app/manifest.ts` `display:'standalone'` + maskable icon 192/512 dari mark 4-warna; `themeColor` di manifest + `viewport` export + `apple-mobile-web-app-status-bar-style` meta; `viewportFit:'cover'`; safe-area inset di tab-bar/header/FAB. Dorong "Add to Home Screen".

## 10. Fase + gerbang verifikasi
- **F0 — Fondasi**: remap token + Plus Jakarta + manifest/safe-area + global CSS shell. Gate: `npm run build` hijau + cek paritas desktop. Try-on: screenshot beberapa layar (light/dark).
- **F1 — Komponen inti** (§6). Gate: tsc/lint hijau + render di story/preview.
- **F2 — Beranda** (showcase). Try-on → ACC.
- **F3 — Transaksi · Anggaran · Investasi** (layar kerja). Try-on per-layar.
- **F4 — Aliran Uang (Sankey) · Kekayaan · Research · Profil · auth/onboarding.**
- **F5 — Polish**: animasi micro, empty states, audit 360-390px nol overflow, audit kontras AA, audit "≤15% brand color".
Tiap fase: mobile-first, per-layar, **try-on → ACC → merge**. Verify `npm run build` + 245 unit test tetap hijau.

## 11. Risiko & guardrail
- **Live app**: kerja di branch; brand kena web+mobile → cek desktop tiap fase sebelum merge.
- **User labil desain** ([[feedback_plan_dulu]]): WAJIB try-on → approve → eksekusi; jangan nyemplung kode besar tanpa user lihat.
- **Hardcoded hex**: jangan asal token-ize Satori og/email/Sigma/CATEGORY_COLORS DB (literal by-design).
- **next build skip *.test.ts** + vitest esbuild → jalanin `npm run typecheck` (tsc) juga (udah jadi step CI).
- **Path repo** pindah ke `2. Finance and Investment\Klunting` — pakai itu (bukan Web-Apps lama).
