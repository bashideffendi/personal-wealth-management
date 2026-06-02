# Klunting — Rekomendasi dari Studi YNAB · Monarch · Lunch Money · PocketSmith

Berdasarkan studi live ke-4 app (lihat `competitive-study-2026-06.md`). Disusun
per area, urut prioritas. Tiap item: **apa kata kompetitor → kondisi Klunting →
rekomendasi → effort**. Skala effort: S (≤½ hari) · M (1–2 hari) · L (≥3 hari).

Legenda prioritas:
- **P0** = high impact, sejalan ide user, fondasi. Kerjain duluan.
- **P1** = impact bagus, effort sedang.
- **P2** = nice-to-have / nanti.

---

## RINGKASAN — 5 hal terpenting
1. **Anggaran: tambah view BULANAN + toggle Bulan/Tahun (sinkron).** Ide user, dan
   persis cara Monarch (Month/Year/Decade dari data yg sama). **P0.**
2. **Kolom Rencana vs Realisasi vs Sisa** di anggaran. Semua app punya. Cocok banget
   buat mindset auditor. **P0.**
3. **Onboarding first-run** (profiling tujuan + setup akun nama/tipe/saldo + pilih
   kategori). Semua app nanya dulu. **P0.**
4. **Login/landing punchy ala YNAB** (headline pertanyaan, 1 aksen, ilustrasi). **P1.**
5. **Tambah kategori/sub inline di tabel** (opsi tambahan, bukan ganti modal). **P1.**

---

## A. LOGIN & LANDING  (user: "tampilan login YNAB mau kutiru")
**Kompetitor:** YNAB landing = headline display gede berbentuk pertanyaan ("Bad at
money? YNAB can help."), subhead pendek, **1 CTA hijau**, reassurance "no credit card
required", ilustrasi playful (phone + duit terbang), BG gradient + wave. Login =
kartu form minimal di atas bg brand, 1 aksen, copy ramah.

**Klunting:** login/register sudah Wise-clean, tapi belum "punchy". Landing sudah
ada hero + pricing + FAQ.

**Rekomendasi:**
- Login jadi **split-screen**: kiri = panel brand (gradient Klunting + headline
  pertanyaan + 1 kalimat value + mini-ilustrasi/angka), kanan = form minimal
  (magic-link/email) + "Gratis, tanpa kartu kredit". **M**
- Landing hero: headline **pertanyaan/benefit** ("Bingung uang lari ke mana?
  Klunting bantu.") gaya display serif + 1 CTA + reassurance. Ganti stok jadi
  mockup app sendiri. **M**
- Konsisten **1 warna aksen** (mint) buat semua CTA. **S**

## B. ONBOARDING / FIRST-RUN  (user: "semua app nanya-nanya dulu, profiling + setup")
**Kompetitor:** Semua nanya dulu. YNAB: tambah akun (nickname + **tipe dgn
penjelasan** + saldo) lalu assign. Monarch: tujuan ("what brought you here") +
connect/manual akun. LM: **checklist** (review tx / balanced / recurring / setup
akun) dgn centang hijau. Account-type picker YNAB **dikelompokin + 1 kalimat
penjelasan tiap tipe**.

**Klunting:** belum ada wizard profiling; user baru langsung masuk dashboard kosong.

**Rekomendasi (wizard 4 langkah, skippable):**
1. **Kenalan/tujuan**: "Apa fokusmu? (Hemat lebih · Lunasin utang · Bangun dana
   darurat · Lacak kekayaan)" → multi-select, dipakai buat highlight fitur. **S**
2. **Buat akun pertama**: form ala YNAB — **nama · tipe (dikelompokin: Kas
   [rekening/dompet/e-wallet], Kartu Kredit, Pinjaman, Aset/Investasi] + 1 kalimat
   penjelasan) · saldo sekarang**. **M**
3. **Pilih kategori**: tampilkan default tree (yg udah ada) + contoh sub (Netflix
   dll) → bisa centang/uncentang. **S**
4. **Selesai → checklist progress** (ala LM) di dashboard: "Tambah transaksi
   pertama · Set anggaran · Tambah tujuan" dgn centang. **M**
- Simpan `onboarded` flag di profile; tampilkan wizard cuma sekali; bisa "Lewati".

## C. ANGGARAN — BLOK TERPENTING
### C1. View Bulanan + toggle Bulan/Tahun (sinkron)  **P0 · L**
**Kompetitor:** Monarch toggle **Month / Year / Decade** dari data sama. YNAB
bulanan murni. **Klunting:** tahunan-only (12 bulan = kolom).
**Rekomendasi:**
- Tambah toggle **Bulan | Tahun** di header Anggaran.
- **Tahun** = grid sekarang (tetap).
- **Bulan** = fokus 1 bulan: baris kategori, kolom **Rencana · Realisasi · Sisa**,
  + switcher ‹ bulan ›. Data SAMA (nilai bulan ke-N di grid tahunan = kolom Rencana
  di view bulan ke-N). Edit di salah satu → sinkron.
- Simpan preferensi view terakhir.

### C2. Kolom Realisasi (aktual) + Sisa  **P0 · M**
**Kompetitor:** Planned/Actual/Remaining (Monarch), Budgeted/Activity/Available
(YNAB/LM). **Klunting:** isi rencana aja; realisasi belum diadu di tabel.
**Rekomendasi:** hitung realisasi dari transaksi per (kategori, bulan) — sekarang
kategori udah satu sumber kebenaran + key komposit nyambung, jadi tinggal agregasi.
Tampilkan **Rencana vs Realisasi vs Sisa** + bar progress per baris (ala YNAB).

### C3. "Sisa Dialokasikan" jadi indikator zero-based  **P1 · S**
**Kompetitor:** Ready to Assign (YNAB) / Left to Budget / Balanced (LM). **Klunting:**
udah ada "Dialokasikan / Sisa Dialokasikan". **Rekomendasi:** angkat jadi **pill
status** ("Seimbang ✓" / "Sisa Rp X belum dialokasikan") biar berasa zero-based.

### C4. Tambah kategori/sub INLINE di tabel  **P1 · M**  (user minta eksplisit)
**Kompetitor:** YNAB "+ Category Group" & LM "Set budget" inline. **Klunting:** cuma
via modal Kelola Kategori. **Rekomendasi:** baris "+ Tambah kategori" di akhir tiap
grup & "+ sub" saat hover baris kategori — **opsi tambahan**, modal tetap ada.

### C5. Target per kategori (opsional, YNAB-style)  **P2 · L**
**Kompetitor:** YNAB Targets (Weekly/Monthly/Yearly/Custom: "butuh Rp X by tanggal").
**Klunting:** punya Goals global. **Rekomendasi:** target per kategori anggaran yg
ngitung "harus nyisihin berapa biar on-track" + bar progress. Nyatu sama C2.

### C6. "Sembunyikan kategori tanpa anggaran"  **P2 · S**
**Kompetitor:** LM/Monarch "Show N unbudgeted". **Rekomendasi:** toggle sembunyiin
baris yg nilainya 0 sepanjang periode biar tabel bersih.

## D. DASHBOARD & EMPTY STATE
- **Empty state = onboarding** (Monarch): tiap widget yg kosong kasih 1 kalimat +
  CTA setup, bukan kosong/0. **P1 · M**
- **Checklist "Mulai di sini"** (LM) di dashboard buat user baru, auto-hilang kalau
  beres. **P1 · S** (nyatu sama B4)
- **Dashboard customizable** (Monarch "Customize", drag widget) — **P2 · L**, nanti.

## E. TUJUAN (Goals)
**Kompetitor:** Monarch **Save up / Pay down**, status **On track / At risk /
Completed**, **gambar per goal**, progress + marker pace. **Klunting:** punya goals.
**Rekomendasi:**
- Status otomatis **On track / At risk** (bandingin pace vs target tanggal) + pill. **M**
- **Gambar/emoji per goal** (aspiratif). **S**
- Mode **"Lunasi utang"** sbg goal yg narik dari halaman Utang/Kartu Kredit. **M**

## F. AKUN & KEKAYAAN
**Kompetitor:** Monarch: net-worth chart di atas Accounts, akun **dikelompokin per
tipe + subtotal + last-sync**, Summary Assets/Liabilities + toggle **Totals/Percent**.
**Rekomendasi:** kalau belum: grup akun per tipe + subtotal, ringkasan
Aset/Liabilitas + toggle Total/Persen di halaman Akun/Kekayaan. **M**

## G. FORECASTING / CALENDAR  (PocketSmith USP)
**Kompetitor:** proyeksi saldo ke depan (aktual vs proyeksi) + calendar uang (chip
income/bill per hari + saldo harian). **Klunting:** udah ada Recurring + CashflowForecast.
**Rekomendasi:**
- **Proyeksi saldo** sederhana dari recurring: "Perkiraan saldo akhir bulan: Rp X". **M**
- **Calendar view** opsional di Recurring (tanggal jatuh tempo + masuk). **P2 · L**

## H. TRANSAKSI
- **Kolom Proyeksi** (LM: PROJ. spend bulan ini berdasar pace). **P2 · M**
- Sudah kuat (tree, quick-add, filter, CSV, bulk import). Pertahankan.

## I. VISUAL / BRAND / COPY
- **1 warna aksen konsisten** (mint) buat semua CTA. **S**
- **Microcopy berkepribadian** (YNAB): loading state, empty state, sukses — kasih
  1 kalimat ramah khas Klunting (jangan kaku). **S**
- **Light + lega + kartu rounded lembut** (semua app gitu). Pertahankan arah
  premium-minimalis, kurangi kepadatan kalau ada.

## J. GROWTH (kalau mau monetize)
- **Trial countdown** + progress di tempat keliatan (Monarch sidebar). **S**
- **Referral "Ajak teman"** (Monarch "$30"). **P2 · M**

---

## USULAN URUTAN BUILD (fase)
- **Fase 1 (fondasi pengalaman):** B (onboarding wizard) + C1 (toggle bulan/tahun)
  + C2 (realisasi). Ini yg paling kerasa & sejalan ide user.
- **Fase 2 (polish konversi):** A (login/landing punchy) + D (empty states +
  checklist) + I (aksen + microcopy).
- **Fase 3 (kedalaman):** C4 (inline add) + E (goals status/gambar) + F (akun grup).
- **Fase 4 (lanjutan):** C5 (target per kategori) + G (forecast/calendar) +
  C6/H/J.

> Catatan: ini rekomendasi, belum dieksekusi. Tunggu ACC user mana yg dikerjain
> duluan.

---

# TAMBAHAN dari studi PUTARAN 2 (Advice, Forecasting, Auto-budget, dll)

## K. PLAYBOOK FINANSIAL ber-AI  ⭐ DIFFERENTIATOR  **P1 · L**
**Kompetitor:** Monarch **Advice** = library "playbook" (Buy a home, Pay off loans,
Emergency fund…), tiap playbook = **daftar tugas + progress**, diprioritasin dari
**kuesioner profiling**, dikelompokin Save/Spend/Pay down/Protect/Invest/Wellness.
**Peluang Klunting:** kita punya **Claude API** + konteks Indonesia + mindset
terstruktur (auditor). Bikin **playbook konteks lokal**:
- Dana Darurat (3–6× pengeluaran), DP Rumah / KPR, Lunasi Paylater & Kartu Kredit,
  Dana Pendidikan Anak, Dana Pensiun, **Naik Haji/Umrah**, **Qurban**, Dana Nikah,
  Dana Darurat Freelancer.
- Tiap playbook: **langkah/tugas bercentang + progress**, angka di-personalisasi
  dari data user (income, pengeluaran, saldo), narasi dipandu **Claude**.
- Diprioritasin dari jawaban onboarding (B1). Nyatu sama Tujuan (Goals).
→ Ini bikin Klunting beda dari sekadar "pencatat" — jadi **pemandu**. Cocok sama
  jatah kredit Jatevo/Claude.

## L. ONBOARDING: Auto-budget dari histori  **P1 · M**
**Kompetitor:** PocketSmith **"Auto-budget tool"** (generate budget dari histori,
bulk). **Rekomendasi:** setelah user input transaksi/import, tawarin **"Sarankan
anggaran dari 3 bulan terakhir"** → isi kolom Rencana otomatis (rata-rata per
kategori). Ngurangin friksi isi anggaran dari nol. Nyatu sama C1/C2.

## M. Verdict anggaran bahasa manusia  **P2 · S**
**Kompetitor:** PocketSmith "You have budgeted to **earn more than you will spend**
for this period." **Rekomendasi:** 1 kalimat status di atas tabel anggaran:
"Rencanamu **surplus Rp X** bulan ini ✓" / "Kamu over-budget Rp Y — rapikan dulu".
Lebih manusiawi drpd angka mentah.

## N. Tab "Struk" (galeri receipt)  **P2 · M**
**Kompetitor:** Monarch Transactions punya tab **Receipts**. **Klunting:** udah ada
foto struk (scan). **Rekomendasi:** galeri struk terpisah (grid foto + link ke
transaksinya) — manfaatin yg udah ada.

## O. Savings Rate sbg metrik headline + halaman Cash Flow  **P2 · M**
**Kompetitor:** Monarch Cash Flow: Income/Expenses/Total Savings/**Savings Rate %**
+ Sankey + breakdown Category/Group/Merchant. **Klunting:** udah ada saving-rate
ring. **Rekomendasi:** angkat Savings Rate jadi metrik utama + (opsional) **Sankey**
income→expense di Laporan.

## P. Detail lain yg layak dicicil
- **Transactions: kolom customizable + saved views/filter** (Monarch). **P2 · M**
- **Budget "2-minggu" view** buat yg gajian 2-mingguan (LM). **P2 · S**
- **Freemium gating** halus ("Plan gratis: N kategori, upgrade…") kalau monetize. **P2**
- **Forecasting net-worth jangka panjang + life-event** (Monarch) — versi ringan,
  masuk Fase 4 bareng G. Visual serif-italic = referensi.

## Update urutan build
- **Fase 1:** B (onboarding) + **L (auto-budget)** + C1 (toggle bulan/tahun) + C2
  (realisasi) + **M (verdict)**. Auto-budget bikin onboarding gak hampa.
- **Fase 2:** A (login/landing) + D (empty states) + I (aksen/microcopy).
- **Fase 3:** **K (Playbook ber-AI)** + E (goals status/gambar) + C4 (inline add) +
  N (galeri struk).
- **Fase 4:** C5 (target/kategori) + G+Forecasting + O (savings/sankey) + P.

---

# TAMBAHAN dari PUTARAN 2b (sumber publik)

## Q. TAGS — label lintas-kategori  ⭐ NEW  **P1 · M**
**Kompetitor:** Lunch Money **Tags** (beda dari kategori). 1 transaksi = 1 kategori,
tapi bisa banyak tag, color-coded. **Peluang Klunting:** lacak hal **lintas-kategori**
yg musiman/proyek: **"Lebaran", "Liburan Bali", "Renovasi Rumah", "Nikahan",
"Anak Sekolah Baru"** — nyebar di Makanan+Transport+Belanja. Filter & laporan
per-tag. Cocok juga buat mindset audit (tag per "kegiatan"). Belum ada di Klunting.

## R. Transaksi: Split + Bulk edit + Merchant merge  **P1 · M (split) / P2 (sisanya)**
**Kompetitor:** Monarch. **Split** (1 transaksi → beberapa kategori, by amount/%) —
kasus nyata: 1 belanja Indomaret = groceries + rumah tangga + jajan. **Bulk edit**
(ubah kategori/tanggal banyak transaksi sekaligus). **Merchant merge** (gabung nama).
**Klunting:** punya rules; **split** belum ada & paling berguna. Rekomendasi: split
dulu, bulk-edit nyusul.

## S. Dua mode anggaran: Sederhana vs Detail  **P2 · M**
**Kompetitor:** Monarch **Flex vs Category**. **Rekomendasi:** mode **Sederhana**
(cukup grup Tetap / Fleksibel / Non-bulanan — pantau 1 angka "fleksibel") buat
pemula, dan mode **Detail** (per kategori, yg sekarang) buat power user. Toggle di
Settings anggaran. Nurunin friksi buat user baru.

## T. Onboarding — prinsip (mempertajam rec B)
Dari best-practice + beda YNAB(curam) vs Monarch(cepat):
- **Progressive disclosure** + **jelasin kenapa** tiap nanya.
- **Saran tujuan pertama** + **auto-budget** (rec L) biar gak hampa.
- Sediakan jalur **"lihat-lihat dulu"** (isi 1 akun → eksplor) sebelum maksa setup
  budget penuh. Target: user "ngerti" < 10 menit (lebih cepat dari Monarch 30 mnt).

---

## STATUS STUDI
Sudah: UI live ke-4 app (login→onboarding-empty-states→budget bulanan&tahunan→
goals→akun→cashflow→transaksi→advice→forecasting→calendar) + method/help-docs/
feature-pages + best-practice onboarding. **Amunisi cukup buat eksekusi.** Tinggal
tunggu user pilih mulai dari fase/fitur mana.

---

# TAMBAHAN dari PUTARAN 3 — KHAS INDONESIA  ⭐ (pembeda dari app global)

## U1. Tipe akun & utang ID-native  **P1 · M**
Tambah tipe akun **E-wallet** (OVO/GoPay/DANA/ShopeePay/LinkAja) first-class +
tipe utang **Paylater** (SPayLater/GoPayLater/Kredivo/Akulaku) selain Kartu Kredit.
Onboarding account-type picker (rec B2) tampilin ini. → app global gak punya.

## U2. Pelacakan Paylater + nudge literasi  **P1 · M**
Paylater = dominan + sering impulsif krn literasi rendah. Lacak saldo & cicilan
paylater (manfaatin Utang + CompoundDebtWarning yg ada), kasih **peringatan
bunga/cicilan** & ringkasan "total paylater kamu Rp X di N layanan". Edukasi singkat.

## U3. Daily check-in / streak (habit loop)  **P2 · M**
Finku pakai daily check-in buat bangun kebiasaan. Klunting: streak ringan ("catat
hari ini", beruntun N hari) — dorong konsistensi tanpa norak.

## U4. Budget limit + notifikasi per kategori  **P2 · M**
Ekspektasi user ID: batas per kategori + **notif kalau lewat**. Nyatu sama anggaran
(C2 realisasi) — kasih warning saat realisasi > rencana.

## U5. Kategori & momen khas ID  **P1 · S**
Default tree tambah konteks lokal: **Zakat/Infaq/Sedekah, Arisan, Pulsa & Paket
Data, Ojek/Taksi Online, QRIS, THR (income), Cicilan**. Playbook (rec K) juga:
Haji/Umrah, Qurban, THR/Lebaran, Dana Nikah. → langsung kerasa "buat orang Indonesia".

## U6. Sinyal kepercayaan & transparansi  **P2 · S**
Pesaing lokal jual "OJK"; Klunting (bukan lembaga keuangan) jual **keamanan data +
manual-first + UU PDP + billing transparan + gampang cancel** (justru pain-point
app global). Tonjolin di landing + onboarding.

> **Wedge final:** UX premium app global × ID-native (IDR, e-wallet/paylater,
> manual-first, kategori lokal, harga wajar, AI playbook). Gak ada pesaing yg
> nutup dua sisi ini sekaligus.

---

# TAMBAHAN dari Actual Budget (OSS)

## C5+ (UPGRADE) — Target per kategori pakai "mode" ala Actual Goal Templates  **P2 → naik nilai · L**
Gabung **C5 (target) + L (auto-budget)** jadi satu picker target per-kategori dgn MODE
(UI terstruktur, bukan teks):
- **Tetap** (Rp X/bln) · **Isi sampai** (refill up-to Rp X) · **Nabung sampai tanggal**
  (bagi rata sisa bulan) · **Tiap N minggu/bulan** · **% dari income** · **Rata-rata
  N bulan terakhir** (= auto-budget) · **Sisa** (bagi remainder).
- **Indikator warna** baris: hijau (tercapai) / oranye (belum) / merah (negatif).
→ Ini target paling ekspresif di pasar; bikin anggaran Klunting "pinter" tanpa ribet.

## C7 (NEW) — Overspending rollover + transfer antar kategori (view bulanan)  **P2 · M**
Dari Actual: kalau realisasi kategori > rencana, **defisit di-roll ke "sisa
dialokasikan" bulan depan** (maksa nutup) — opsional "biarkan negatif" buat
reimbursable. Plus **pindah dana antar kategori** (rebalance). Nyatu sama C1/C2/C3.

## Catatan pricing (karena ada "YNAB gratis" OSS)
Actual = YNAB gratis open-source. Implikasi: tier berbayar Klunting **harus jelas
beda value** — ID-native (e-wallet/paylater/kategori lokal) + UX premium + **AI
playbook** + **zero-setup (gak usah self-host)** + dukungan. Condong ke **freemium**
(core gratis, Pro buat AI/playbook/laporan lanjut) drpd paywall total. Tonjolin
**ekspor data + no lock-in** (lawan kekhawatiran "kekunci di app berbayar").
