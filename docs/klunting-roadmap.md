# Klunting — Rencana Induk (sintesis studi YNAB · Monarch · Lunch Money · PocketSmith · Actual + pasar ID + audit desain)

Dokumen ini = "apa yang akan kuperbuat untuk Klunting", disusun dari studi mendalam
(detail di `competitive-study-2026-06.md` + `competitive-study-recommendations.md`).
Urutan = by dependency + dampak + prioritas yg kamu sebut (desain dulu).
Effort: S (≤½ hari) · M (1–2 hari) · L (≥3 hari).

---

## ★ NORTH STAR (kenapa Klunting ada)
**"Aplikasi keuangan dengan UX premium kelas dunia, tapi ngerti orang Indonesia."**

Wedge yg gak dimiliki pesaing manapun (kesimpulan studi):
- Vs app global (YNAB/Monarch/LM/PocketSmith): mereka **mahal (US$40–120/thn ≈ Rp
  650rb–1,9jt), bank-sync rapuh, lemah di luar US, no IDR/e-wallet/paylater**.
- Vs app lokal (Finansialku/Finku/Money Lover): UX & desainnya **biasa**, gak
  audit-grade, gak ada AI pemandu.
- **Klunting = premium-global-UX × ID-native × manual-first × dipandu Claude.**
  Manual-first itu FITUR (anti sync-rusak/transaksi ke-delete — keluhan #1 app global),
  bukan kekurangan.

Positioning 1 kalimat: *"Atur uang tanpa ribet konek bank, tanpa mahal, dengan
panduan yang ngerti hidup orang Indonesia."*

---

## ★ PRINSIP DESAIN (dipegang di semua fase)
1. **Proporsi & restraint** — angka besar boleh, tapi jangan makan layar; ada ukuran
   tengah. (Hero Klunting sekarang ~420px tinggi, angka 64px lompat ke teks 10px.)
2. **Type-scale ketat** — tangga ukuran resmi, bobot konsisten. Satu typeface (Inter)
   + serif italic cuma buat "momen".
3. **Teks kebaca** — konten = ink gelap; abu cuma label sekunder; **stop teks abu pucat**
   (`text-faint #A1A1AA` gagal AA; putih@40% di hero pucat).
4. **Satu warna aksen** (emerald) buat semua CTA; warna lain = makna (coral=keluar,
   amber=nabung, violet=AI).
5. **Rencana vs Realisasi** di mana-mana (mindset auditor — kekuatan unik user).
6. **Progressive disclosure** — minta seperlunya, jelasin kenapa, jangan form panjang.
7. **Konteks Indonesia** di copy, kategori, tipe akun, playbook.
8. **Microcopy berkepribadian** (ala YNAB "Making cha-ching sounds").

---

# FASE 0 — Fondasi Desain (Design System Reset)  ⏳ DULUAN
> Kenapa duluan: langsung jawab 3 unek-unek user (proporsi/keseragaman/kontras), DAN
> bikin semua UI fase berikutnya otomatis konsisten. Tanpa ini, tiap fitur baru
> nambah inkonsistensi.

**0.1 Type scale + irama spasi**  · M
- Definisikan tangga resmi di `globals.css` (token + util class), mis:
  `display 34–38 · h1 22 · h2 18 · title 16 · body 14 · sm 13 · label 11.5 (uppercase)`;
  bobot: number/display 600–700, judul 600, body 450, label 600.
- Sapu ukuran ad-hoc (`10/11/13/14/18/40–64`) → pakai tangga.

**0.2 Bersihin abu + kontras**  · M
- Ciutkan token teks jadi **3 peran**: `--ink` (konten), `--ink-muted` (sekunder,
  pekat), `--ink-soft` (label paling redup, min AA). Pensiunkan pemakaian
  `--text-faint/--text-mute/--stone-light` buat TEKS (boleh buat border/disabled).
- Hero: naikin opacity teks putih (40%→62%, 55%→74%).
- Aturan tertulis di komentar globals biar konsisten ke depan.

**0.3 Right-size NetWorthHero**  · M
- Angka `clamp(40,64) → clamp(28,38)`; padding `40→24`; gap `48→24`; chart lebih
  pendek; aset/utang jadi baris ringkas. Target tinggi hero **~240px** (tetap dark
  premium, gak makan layar). Naikin teks pendukung ke type-scale (label 11.5, nilai 16).
- *Alt (kalau user mau):* demote hero → stat-strip (Net Worth + Aset + Utang +
  delta sbg 4 KpiCard) + chart di kartu biasa (ala Monarch/YNAB).

**0.4 Sapu Dashboard ke sistem baru**  · M  → lalu halaman lain bertahap.

**Selesai kalau:** dashboard kebaca enak, proporsi hero wajar, gak ada teks abu pucat,
ukuran font berirama. Build hijau + cek visual.

---

# FASE 1 — Login → Onboarding → Aktivasi
> Pengalaman "dari login sampai dipakai" (yg user tekankan). Semua app nanya dulu &
> nuntun; Klunting belum.

**1.1 Login & landing punchy**  · M — split-screen: brand+headline pertanyaan (gaya
YNAB tapi ID, mis. "Bingung uang lari ke mana?") + 1 CTA emerald + "gratis, tanpa
kartu kredit" + mockup app sendiri.

**1.2 Onboarding wizard (4 langkah, skippable, progressive)**  · L
1. **Fokus/tujuan** (multi-pilih: hemat · lunasi utang · dana darurat · lacak kekayaan)
   → dipakai highlight fitur + saran playbook.
2. **Akun pertama** — form ala YNAB: nama · **tipe (dikelompokin + 1 kalimat
   penjelasan)** · saldo. Tipe **ID-native**: Bank, **E-wallet** (OVO/GoPay/DANA/
   ShopeePay), Kartu Kredit, **Paylater**, Tunai, Aset/Investasi, Pinjaman.
3. **Pilih kategori** — tree default + contoh sub (Netflix dll), centang/uncentang.
4. **Selesai → checklist progress** di dashboard (catat transaksi · set anggaran ·
   tambah tujuan) yg auto-hilang kalau beres.
- Sediakan jalur **"lihat-lihat dulu"** (isi 1 akun → eksplor) sebelum maksa budget.

**1.3 Auto-budget dari histori**  · M — "Sarankan anggaran dari 3 bulan terakhir" →
isi kolom Rencana otomatis (rata-rata per kategori). Ngilangin friksi mulai dari nol.

**1.4 Empty state = mini-onboarding**  · M — tiap widget/halaman kosong kasih 1
kalimat + CTA setup (ala Monarch), bukan kosong/0.

---

# FASE 2 — Anggaran Naik Kelas (jantung produk)
> Budgeting = fitur inti & paling dipakai. Di sini Klunting beneran "naik kelas".

**2.1 View Bulanan + toggle Bulan/Tahun (sinkron)**  · L — idemu, persis Monarch.
Tahun = grid sekarang; Bulan = fokus 1 bulan (kolom Rencana/Realisasi/Sisa + switcher
‹bulan›). Data sama, edit di salah satu → sinkron. Simpan preferensi view.

**2.2 Kolom Realisasi + Sisa + verdict**  · M — hitung realisasi dari transaksi per
(kategori, bulan) [kategori udah satu sumber kebenaran ✓]. Bar progress per baris +
**verdict bahasa manusia** ("Rencanamu surplus Rp X ✓" / "Over Rp Y, rapikan").

**2.3 Indikator zero-based**  · S — "Sisa Dialokasikan" → pill status (Seimbang ✓ /
sisa Rp X belum dialokasikan). [sebagian udah ada]

**2.4 Tambah kategori/sub INLINE di tabel**  · M — baris "+ kategori" tiap grup &
"+ sub" saat hover (opsi tambahan; modal Kelola Kategori tetap). [user minta]

**2.5 Overspending rollover + transfer antar kategori**  · M — dari Actual: defisit
kategori → "sisa dialokasikan" bulan depan (maksa nutup) / opsi biarkan negatif;
pindah dana antar kategori.

---

# FASE 3 — Target Pintar & Tujuan
> Bikin anggaran "pinter" + tujuan emosional. Depends on realisasi (2.2).

**3.1 Target per kategori — "mode" ala Actual Goal-Templates**  · L  ⭐ paling kuat
Picker terstruktur (BUKAN teks): **Tetap · Isi-sampai · Nabung-sampai-tanggal ·
Tiap-N · %-income · Rata-rata-N-bulan (=auto-budget) · Sisa**. Indikator warna baris
(hijau tercapai / oranye belum / merah negatif). Ini gabungin YNAB Targets +
auto-budget + rollover-goal jadi satu — target paling ekspresif di pasar.

**3.2 Tujuan (Goals) naik kelas**  · M — status otomatis **On-track / At-risk**
(pace vs tanggal) + pill, **gambar/emoji per goal** (aspiratif), mode **Lunasi Utang**
yg narik dari halaman Utang/Kartu Kredit/Paylater (ala Monarch Save up/Pay down).

---

# FASE 4 — ID-Native & Pemandu (the moat — yg bikin gak tergantikan)
> Ini yg gak dipunya app global maupun lokal sekaligus. Beberapa sub = quick win,
> bisa dimajuin (lihat "Quick wins").

**4.1 Paylater & E-wallet first-class + literasi**  · M — tipe akun e-wallet + tipe
utang paylater (SPayLater/GoPayLater/Kredivo/Akulaku). Lacak saldo+cicilan, **nudge
literasi** (peringatan bunga/cicilan; manfaatin CompoundDebtWarning yg ada), ringkasan
"total paylater Rp X di N layanan".

**4.2 Kategori & momen khas ID**  · S — default tree + playbook tambah: Zakat/Infaq/
Sedekah, Arisan, Pulsa & Paket Data, Ojek Online, QRIS, THR (income), Cicilan.

**4.3 ⭐ Playbook Finansial ber-AI (Claude)**  · L — library rencana ber-tugas +
progress, diprioritasin dari onboarding: **Dana Darurat, DP Rumah/KPR, Lunasi Kartu
Kredit & Paylater, Dana Pendidikan, Dana Pensiun, Naik Haji/Umrah, Qurban, Dana
Nikah**. Angka dipersonalisasi dari data user, narasi dipandu Claude. Klunting jadi
**pemandu**, bukan cuma pencatat. (Pakai kredit Jatevo/Claude.)

**4.4 Tags (label lintas-kategori)**  · M — 1 transaksi 1 kategori + banyak tag
(color-coded): "Lebaran", "Liburan Bali", "Renovasi", "Nikahan". Filter & laporan
per-tag. (Butuh tabel `tags` + `transaction_tags`.)

---

# FASE 5 — Pendalaman & Pertumbuhan
**5.1 Transaksi: Split + Bulk edit + Merchant merge**  · M — split 1 transaksi →
banyak kategori (by amount/%) [kasus: 1 struk = groceries+rumah tangga]; edit massal.
**5.2 Forecasting saldo + (opsional) Calendar uang**  · M–L — proyeksi saldo dari
recurring + saving rate; calendar jatuh-tempo (ala PocketSmith, versi ringan).
**5.3 Savings Rate headline + Sankey + galeri Struk**  · M — angkat savings rate;
Sankey income→expense di Laporan; tab Receipts.
**5.4 Dua mode anggaran (Sederhana/Detail)**  · M — Flex (Tetap/Fleksibel/Non-bulanan,
pantau 1 angka) vs Detail (sekarang). Lever simplicity buat pemula.
**5.5 Trust, billing, pricing**  · M — sinyal keamanan data + manual-first + UU PDP +
**billing transparan + gampang cancel** (justru pain-point app global). Trial countdown,
referral, **freemium harga ID-friendly** (core gratis, Pro buat AI/playbook/laporan;
hindari paywall total — ada "YNAB gratis OSS"). Tonjolin **ekspor/no-lock-in**.

---

## ⚡ QUICK WINS (bisa dimajuin kapan aja — kecil, dampak/diferensiasi tinggi)
- **4.2 Kategori khas ID** (S) — instan kerasa "buat orang Indonesia".
- **2.3 Verdict/status zero-based** (S).
- **0.2 Kontras** (M) — langsung naikin keterbacaan.
- **4.1 tipe E-wallet/Paylater** (M) — pembeda tajam, nyatu sama onboarding 1.2.

## 🚫 SKIP (dipelajari, diputuskan TIDAK diambil)
- Arsitektur local-first/CRDT/self-host (Actual) — Klunting hosted Next.js+Supabase.
- Bank-sync otomatis (Plaid dkk) — justru sumber keluhan + gak relevan ID; manual-first.
- Teks mini-language target (Actual `#template`) — ganti picker terstruktur.
- Multiple custom dashboards (PocketSmith) — overkill.
- "Age of Money" (YNAB), Business tracking, Company equity (Monarch) — di luar fokus.
- Investment tracking berat — Klunting udah punya modul investasi terpisah; jgn over-build.

## 🔗 DEPENDENCIES & CATATAN TEKNIS (biar teliti)
- **Fase 0 sebelum semua** (UI inherit).
- **2.2 realisasi sebelum 3.1 target** (target butuh actual).
- **1.2 tipe akun ID sebelum / bareng 4.1**.
- Migrasi: tipe akun/utang ID = mostly string/enum (kemungkinan kecil/none). **Tags
  butuh 2 tabel baru**. Target per kategori = bisa di JSONB tree (CatNode) → minim migrasi.
  Realisasi = agregasi query, no schema. Playbook = tabel progres + prompt Claude.
- Yg SUDAH beres (jangan diulang): kategori satu-sumber-kebenaran, warna/ikon per
  kategori, usage-count + merge/reassign, contoh sub, recurring redesign, CC masuk
  net-worth/DTI, kalkulator, kontrak+polis merged, saving-rate ring, export UU PDP.

## 🗓️ URUTAN EKSEKUSI yg kusaranin
**0 → 1 → 2 → 3 → 4 → 5**, dengan quick-win (4.2, 4.1) bisa diselipin pas Fase 1
(onboarding) karena nyambung. Fase 0–2 = "wajib & paling kerasa". Fase 3–4 = "naik
kelas jadi pemandu & ID-native (moat)". Fase 5 = "power + monetisasi".
