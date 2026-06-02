# Studi Kompetitif — YNAB · Monarch · Lunch Money · PocketSmith

Tanggal: 2026-06-02. Tujuan: pelajari login → onboarding → setup akun → budgeting
(bulanan & tahunan) → transaksi → dashboard → IA & visual, lalu rekomendasi
perbaikan menyeluruh buat Klunting.

Catatan ditulis sambil jalan (live observation di Chrome). Rekomendasi final
ada di `competitive-study-recommendations.md`.

---

## YNAB (app.ynab.com)

### Detail kecil yang langsung kena
- Loading screen: logo pohon "Y" + microcopy main-main ("Making cha-ching
  sounds"), badge "20 Years". Personality di momen nunggu — bukan spinner kosong.

### Struktur layout (3 kolom)
- **Sidebar kiri** (sempit): nama plan + email, nav `Plan / Reflect / All Accounts`,
  lalu daftar akun dikelompokin per tipe (CASH → BCA $5jt), tombol `+ Add Account`
  & `Bank Connections`. Tombol collapse sidebar di pojok kiri-bawah.
- **Tengah**: tabel budget.
- **Kanan = INSPECTOR kontekstual** (berubah sesuai yang dipilih). Ini pola kunci.

### Budgeting = bulanan + zero-based ("give every dollar a job")
- Header: `‹ Jun 2026 ›` switcher bulan + "Enter a note" (catatan per bulan).
- Hero tengah: **"$4.989.000 Ready to Assign"** pill hijau + tombol **Assign**.
  Inti YNAB: semua uang harus "diberi tugas" sampai Ready to Assign = 0.
- Chips filter di atas tabel: `All · Underfunded · Overfunded · Money Available · Snoozed`.
- Toolbar: `+ Category Group` (tambah grup langsung di tabel) · Undo · Redo ·
  Recent Moves · toggle view.
- **Tabel**: kolom `CATEGORY | ASSIGNED | ACTIVITY | AVAILABLE`.
  - Grup kategori (Bills/Needs/Wants) collapsible, punya **subtotal di baris grup**.
  - Tiap kategori: **ikon (emoji) + nama** + **bar progress tipis** di bawah nama
    (funding vs target).
  - Kolom AVAILABLE = **pill** (hijau kalau cukup dana, abu kalau $0).
  - Klik sel ASSIGNED → **inline edit + math** (ikon ×÷, bisa ketik 5000/12 dst) +
    ikon riwayat (jam).
  - Checkbox per baris + per grup → **bulk action**.

### Inspector kanan (saat kategori dipilih) — INI yang powerful
- Header kategori (ikon + nama, editable pencil).
- **Available Balance** (pill hijau) + rincian: Cash Left Over From Last Month /
  Assigned This Month / Cash Spending / Credit Spending.
- **Target** (fitur khas YNAB): "How much do you need for {kategori}?"
  - Cadence tab: **Weekly / Monthly / Yearly / Custom**.
  - "I need [Rp]" · "By [Last Day of Month ▾]" · "Next month I want to
    [Set aside another Rp ▾]".
  - Save Target / Cancel / Delete.
  - Target = sistem goal per-kategori yg ngitung "harus nyisihin berapa biar
    on-track". Bar progress di tabel = visualisasinya.
- **Auto-Assign**: isi otomatis sesuai target/riwayat.
- **Notes** per kategori.

### Pelajaran buat Klunting
1. **Inspector kanan kontekstual** — klik kategori → panel detail (saldo, target,
   catatan). Kita belum punya; tabel kita "datar".
2. **Targets per kategori** (weekly/monthly/yearly/custom) — lebih kaya dari goal
   global kita. Bisa nyatu sama fitur "allocated/left to allocate" yg udah ada.
3. **Ready to Assign / zero-based** sebagai mode opsional (lihat ide 2-view user).
4. **Filter chips** (Underfunded/Overfunded/Money Available) di atas tabel.
5. **Math inline di sel** — kita udah punya ✓.
6. **Ikon + warna per kategori** — kita baru bikin ✓ (YNAB pakai emoji; kita lucide).
7. **Microcopy main-main** di loading/empty state.
8. **+ Category Group / + Category inline di tabel** (user minta ini).

### Tambah akun (relevan ke setup wizard yg user mau)
- Modal "Add Accounts": search bank + grid logo bank populer + **"Add an
  Unlinked Account"** (manual). Klunting ID = manual-only, jadi langsung ke jalur ini.
- Form unlinked: copy ramah "Let's go! And don't worry—you can link later." →
  **(1) Nickname**, **(2) Type**, **(3) Current balance**, Next. Satu pertanyaan
  per baris, bukan form padat.
- **Account type picker = dikelompokin + ada penjelasan tiap grup**:
  - *Cash Accounts*: "funds you own, spend immediately" → Checking, Savings, Cash.
  - *Credit Accounts*: "borrowed money you repay later, often with interest" →
    Credit Card, Line of Credit.
  - *Mortgages and Loans*: "outstanding balance you're paying off" → Mortgage,
    (Auto/Student/Personal Loan, dst).
  - (+ Asset/Investasi di bawah.)
  → Pelajaran: **wizard yg ngajarin sambil ngumpulin** — tiap tipe akun dikasih
    1 kalimat penjelasan. Cocok buat onboarding Klunting.

### Reflect (laporan) — top tabs
`Spending Breakdown` (donut, toggle Categories/Groups, list kanan) · `Spending
Trends` · `Net Worth` (aset vs utang over time) · `Income v Expense` · `Age of
Money` (metrik khas YNAB: umur uang yg dibelanjakan). Filter: bulan + kategori +
akun + Export. → Mirip "Laporan"/dashboard kita; "Age of Money" opsional/unik.

### Visual YNAB
Light theme, aksen **navy + ungu**, CTA **hijau** buat uang. Banyak whitespace,
sans-serif simpel, chrome minimal. Loading screen navy + microcopy ganti-ganti.
Personality di copy ("Cost to Be Me", "Ready to Assign", "Making cha-ching sounds").

---

## Monarch (app.monarch.com)

### IA (jauh lebih dekat ke Klunting drpd YNAB)
Sidebar: Dashboard · Accounts · Transactions · **Cash Flow** · Reports · Budget ·
Recurring · Goals (BETA) · Investments · **Forecasting** · **Advice** · AI Assistant.
Footer sidebar: trial countdown ("Free trial (Plus) 7 days left" + progress bar),
"Invite a friend, get $30", avatar. → PFM lengkap, scope-nya mirip Klunting.

### Dashboard = widget grid yang bisa di-"Customize"
- Tombol **Customize** → rearrange/atur widget.
- Tiap widget punya selektor periode sendiri.
- **Empty state tiap widget JUARA** (mini-onboarding tanpa wizard maksa):
  Budget kosong → "You haven't added any expense budgets. When you start
  budgeting, a summary will appear here." · Business tracking → ilustrasi Sankey +
  "[Set up business tracking]" · Credit score → "[Enable credit score]".
- Widget: Budget(bulan), **Net Worth hero (+trend)**, Spending (this vs last month,
  bar per hari), Transactions, Recurring, Goals, Credit score.

### Budget (`/plan`) — JAWABAN ide 2-view user
- Header: **toggle Month / Year / Decade** + ‹ › + Today + Settings.
  - **Month** = 1 bulan, kolom **Planned / Actual / Remaining** (fokus YNAB-style).
  - **Year** = grid 12 bulan (Jan…Des kolom) = **PERSIS tabel tahunan Klunting**.
  - **Decade** = 10 tahun. SEMUA dari data yg sama, beda lensa waktu.
  → Ide user (bulanan+tahunan sinkron) = persis cara kerja Monarch. Klunting udah
    punya Year; tinggal tambah **Month view + toggle Month/Year**.
- Kolom **Planned / Actual / Remaining** — cocok buat mindset track-realisasi.
- Grup default: **Fixed / Flexible / Non-Monthly** (+ Income, Contributions).
- **"Show N unbudgeted"**: kategori tanpa budget disembunyiin di balik toggle →
  tabel cuma yg aktif. Bersih.
- Right rail: "$X Left to budget" + tab Summary/Income/Expenses.

### Goals (`/goals`) — Save up / Pay down
- Dua mode: **Save up** (nabung) & **Pay down** (lunasin utang) — utang jadi tipe goal.
- Tiap goal: **progress bar + marker pace** + **status pill** (On track / At risk /
  Completed) + **foto/thumbnail** (Vacation, Home Down Payment). Aspiratif & emosional.
- Empty: "Plan for your future. Save up for anything… [+ Add goals]".
- → Pelajaran: status **On track / At risk** otomatis (vs target waktu), **gambar
  per goal**, dan utang-sebagai-goal (kita pisah Utang & Tujuan).

### Visual Monarch
Light, lega, kartu rounded lembut, palet muted + aksen **coral/orange** (logo
kupu-kupu), sans-serif bersih. Minimalis tapi padat info — vibe "simple minimalis"
yg user suka.

### Accounts (`/accounts`)
- Atas: **NET WORTH** big number + line chart (Net worth performance / periode).
- Akun **dikelompokin per tipe** (Cash → BCA) + subtotal grup + **"1 hour ago"
  (last sync)**. Right rail: **Summary** Assets/Liabilities + bar alokasi +
  toggle **Totals/Percent** + Download CSV.
- **Add account** modal: search 13.000 institusi + kategori (Banks & credit cards /
  Investments & loans / Real estate, crypto / Company equity [New] / Import CSV) +
  **Add manual account**. → manual + CSV + link, semua satu pintu.

### Pelajaran Monarch buat Klunting
1. **Toggle Month/Year (+Decade)** di Anggaran — fitur paling penting buat user.
2. **Planned / Actual / Remaining** sebagai kolom (track realisasi).
3. **"Show N unbudgeted"** — sembunyiin kategori yg gak dianggarkan.
4. **Dashboard widget customizable** + empty-state mini-onboarding per widget.
5. **Goals: Save up / Pay down** + status On track/At risk + gambar per goal.
6. **Net worth chart** di atas Accounts; grup akun + last-sync + Totals/Percent.
7. Aksen warna tunggal yg kuat (coral) + light + lega.

---

## Lunch Money (my.lunchmoney.app)

### Konteks penting
- **Native IDR!** "Est. Net Worth IDR 0", "Total Income Earned IDR 0". Multi-currency
  beneran — relevan karena Klunting IDR-first. LM bukti pasar global pakai IDR.
- Banner trial atas: "Your free trial ends on Jul 2, 2026. Enter your billing
  information…" — jelas + actionable.
- Vibe: **power-user / spreadsheet-y**, font rounded ramah (mirip Quicksand), aksen
  hijau, logo emoji smiley. Kurang polish visual, kaya tool. **Bukan model visual**
  buat Klunting (user mau premium), tapi **bagus buat ide fitur**.

### IA
Top: HOME / FINANCES / SETUP. Sub-nav HOME: **Overview / Net Worth / Stats /
Trends / Calendar**. Period switcher "THIS MONTH: Jun 1–30, 2026" ‹ ›.

### Overview
- Kiri: **Accounts Overview** (Est. Net Worth) + **Period Summary** (Income / Expenses /
  **Net Income**).
- Tengah: **Spending Breakdown** (bar Income vs Expenses) + tabel kategori dgn kolom
  **TOTAL EARNED/SPENT · PROJ. EARN/SPEND · % OF TOTAL**. → **kolom PROJECTED**
  (proyeksi akhir bulan) keren, kita belum punya.
- Kanan: **checklist onboarding/status** dgn centang hijau: "Review transactions —
  All cleared ✓ · Balanced for this period ✓ · Review recurring items ✓ · Setup
  accounts ○". → **guided setup + rasa progress**. Mirip yg user mau pas first-run.

### Pelajaran LM
1. **Kolom Projected** (proyeksi) di samping actual + % of total.
2. **Checklist onboarding/status** (review tx / balanced / recurring / setup akun).
3. **Multi-currency / IDR** (validasi pasar).
4. **Calendar view** (lihat transaksi per tanggal — distinctive).
5. Period switcher konsisten di semua view.

### Budget (`/budget`) — FINANCES > Budget
- Modal feature-announce ("Welcome to the all-new budgeting feature 🎉") nyebut:
  **custom period (weekly / bi-weekly / custom dates)**, **smart rollover per
  kategori**, unified income pool. → period fleksibel + rollover = paling fleksibel
  dari ke-4 app.
- ‹ › Jun 2026 + **"Jump to period"** dropdown. Toggle **Budget View / Settings View**.
- **INFLOW**: Income — kolom **Expected / Activity / Budgetable**.
- **OUTFLOW**: kolom **Budgeted / Activity / Available**. Grup+sub pakai **emoji
  ikon** (Food and Drinks → Groceries/Restaurants; Housing → Rent/Mortgage; dst).
  Inline **"Set budget"** tiap baris + chevron drill.
- Right rail: **"Balanced for this period ✓"** + Budget Overview (Budgetable /
  Total Budgeted / **Left To Budget** / Budget Status / Net Total Available).
- → Pelajaran: **rollover per kategori**, **custom period**, **Expected income**,
  health panel "Left to budget + Balanced", view/settings split.

---

## PocketSmith (my.pocketsmith.com)

### Identitas
- Top nav (bar ungu gelap): **Dashboard / Transactions / Calendar / Budget /
  Reports**. (Demo mode, nilai dlm **Rp** juga.)
- **Multiple customizable dashboards**: "Transaction Statistics ▾" bisa diganti,
  "+ Add new dashboard", "Show editing controls". Tiap widget periode sendiri
  (Rolling Year / Rolling Month). → dashboard-builder buat power user.
- USP = **Calendar-based cash-flow FORECASTING** (proyeksi saldo ke depan).
- Banner: "Welcome to your customizable financial dashboard. Completely
  configurable, extremely flexible…".

### Dashboard
- Bar chart Earned(hijau)/Spent(merah) per bulan + **garis Average** + "Totals for
  period: Earned/Spent/Difference". Widget: Savings Rate, Daily Spending, Recent
  Transactions. Semua widget punya period-picker sendiri.
- Visual: lebih "tool/dashboard-builder", ungu gelap + hijau/merah. Powerful tapi
  rame — bukan minimalis.

### Calendar (`/calendars`) — USP PocketSmith
- Atas: **grafik proyeksi saldo** (teal = aktual/lampau, biru = proyeksi masa depan)
  sepanjang waktu + **brush selector** buat zoom rentang waktu (Mar'26→Des'26).
  "Balances Mar 1 – Dec 31". Bisa lihat saldo naik-turun ke depan.
- Bawah: **kalender uang** (Sun–Sat × minggu). Tiap sel hari: chip income/bill/budget
  (Rent, Entertainment, Eating Out, Groceries, Salary, Repay Credit Card) + amount +
  **🚩 forecast markers** (Car Loan Forecast Start, Starting Balance) + **saldo
  harian berjalan** di bawah sel.
- Kiri: filter All accounts, "Show actuals in history", multi-account, daftar akun
  + saldo. "+ New budget", Today, June▾ 2026▾.
- Inti: **budget = event berulang yg nyetir proyeksi saldo masa depan**. "See how
  your budgets affect your actual balances and project your finances into the future."
- → Pelajaran: **forecasting cash-flow** (proyeksi saldo), **calendar view uang**,
  budget recurring → forecast. Klunting udah ada Recurring + CashflowForecast;
  PocketSmith bikin lebih visual.

### Pelajaran PocketSmith
1. **Proyeksi saldo ke depan** (aktual vs proyeksi) + brush waktu.
2. **Calendar view** transaksi/bill per hari + saldo harian berjalan.
3. **Multiple dashboards** custom (mungkin overkill buat Klunting).

---

## Login / Landing (yg user mau tiru — YNAB)
YNAB marketing/landing:
- Nav navy: logo + menu + "Log In" + CTA hijau "Start Your Free Trial".
- Hero: headline display **GEDE & punchy** berbentuk pertanyaan — **"Bad at money?
  YNAB can help."** + subhead italic "Start your free trial and get good at money."
  + CTA hijau + reassurance "It's easy! No credit card required."
- BG gradient kobalt/ungu, aksen hijau, wave cream di bawah. Ilustrasi playful
  (phone mockup app + duit terbang) — BUKAN stock photo.
- Login screen YNAB (yg user suka): kartu form minimal di atas bg brand
  navy/cream, satu aksen hijau, copy ramah. → Tiru: **split/centered, brand kuat
  satu sisi, form minimal, 1 warna aksen, copy manusiawi**.

---

## Tema lintas-app (pola yg BERULANG di 3–4 app → sinyal kuat)
1. **Budget = bulanan-first, dengan lensa waktu yg bisa diganti.** YNAB bulanan;
   Monarch Month/Year/Decade; LM custom period; PocketSmith calendar. Klunting
   sekarang tahunan-only → **tambah Month view + toggle** (ide user benar).
2. **Kolom Planned/Budgeted vs Actual vs Available/Remaining.** Semua app
   bandingin rencana vs realisasi. Klunting tahunan kita isi plan aja — tambah
   actual.
3. **"Left to budget / Ready to Assign / Balanced"** — indikator zero-based
   (YNAB, LM, Monarch). Kita udah mulai (allocated/left to allocate).
4. **Inspector/side-panel kontekstual** (YNAB, LM, Monarch right rail).
5. **Empty state = onboarding** (Monarch widget, LM checklist). Ajak setup, jangan
   kosong.
6. **Onboarding first-run**: tanya tujuan + setup akun (nama/tipe/saldo) +
   kategori. Wizard yg ngajarin (YNAB account-type punya penjelasan).
7. **Ikon + warna per kategori** (YNAB & LM pakai emoji). Kita lucide ✓.
8. **Net worth sebagai hero** (Monarch, LM).
9. **Goals dgn progress + status (on track/at risk) + emosi (gambar)** (Monarch).
10. **Recurring → forecast** (PocketSmith calendar, Monarch forecasting).
11. **Multi-currency / IDR** (LM, PocketSmith pakai Rp) — pasar kita oke.
12. **Personality di copy + microcopy** (YNAB juara).
13. **Satu warna aksen kuat** (YNAB hijau, Monarch coral, LM hijau) + light + lega.
14. **Trial countdown + referral** di tempat yg keliatan (Monarch sidebar).
15. **Inline add/edit di tabel** (YNAB +Category Group, LM Set budget inline).

---

# PUTARAN 2 — studi lebih dalam

## Monarch — Cash Flow (`/cash-flow`)
- Period toggle **Monthly / Quarterly / Yearly** + Filters.
- 4 stat: **Income · Expenses · Total Savings · Savings Rate %**.
- **View toggle: Bar Chart / Sankey** (Sankey = aliran income→expense, distinctive).
- Breakdown toggle **Category / Group / Merchant** + Share.
- → Pelajaran: **Savings Rate** sbg metrik headline (kita ada ring), **Sankey**
  opsional, breakdown by merchant (kita belum punya konsep merchant).

## Monarch — Transactions (`/transactions`)
- Tabs **All / Receipts** (Receipts = galeri struk, tab sendiri).
- Toolbar: Search · Date · Filters · **+ Add** · **Columns** (kolom customizable) +
  dropdown **saved views**. → kolom diatur, saved views/filter, galeri struk.
- (Kosong krn data minim — rules/split/bulk gak keliatan live.)

## Monarch — Advice (`/advice`)  ⭐ IDE BESAR
- "Recommendations" + "**Prioritized by you**" + popover "**Get personalized advice
  by answering a few questions** — We'll provide guidance on how to prioritize…
  [Resume]". → profiling questionnaire → rekomendasi terprioritas.
- **Library of "playbooks"** finansial, tiap kartu = rencana multi-tugas:
  Track cash flow [SPEND], Buy a home [SAVE], Pay off student loans [PAY DOWN],
  Save for college [INVEST], **Save up an emergency fund** [SAVE] ("kami saranin
  3–… bulan"). Tiap kartu: ikon + tag kategori + deskripsi + **"NOT STARTED · N
  TASKS TO COMPLETE"** + progress bar.
- Right: kategori **Recommendations / Save up / Spend / Pay down / Protect / Invest /
  Wellness**.
- → **Pelajaran (cocok banget buat Klunting + Claude AI):** playbook finansial
  ber-tugas + progress, diprioritasin dari kuesioner profiling. Klunting bisa bikin
  **playbook konteks Indonesia**: Dana Darurat, DP Rumah (KPR), Lunasi Paylater/KK,
  Dana Pendidikan, Dana Pensiun, Naik Haji/Umrah, Qurban, Dana Nikah. Di-generate/
  dipandu Claude. Ini differentiator + nyatu sama onboarding profiling.

## Monarch — Forecasting (`/forecast`)  ⭐ aspiratif
- Hero serif display + **italic** ("See how your *future* plays out") — persis vibe
  Instrument Serif italic Klunting. Subhead: model life events, drag & play scenarios.
- **Proyeksi net worth 2026→2050+** (garis dashed) + **marker life-event** di timeline:
  🏠 Buy a home · 👶 Have a kid · 💳 Expense · 📈 Income · 🎉 Retire.
- Scenario builder: slider "retirement age (65)", kartu "Buy a home", "Have a kid".
- → Pelajaran: proyeksi net worth jangka panjang + skenario. Versi ringan Klunting:
  proyeksi dari saving rate + recurring + asumsi togglable. Serif-italic = referensi
  estetik premium.

## PocketSmith — Budget (`/budget`)
- "+ New budget" + **"Auto-budget tool"** (generate budget dari histori, bulk).
- **Total Budget Summary**: **verdict bahasa manusia** "You have budgeted to *earn
  more than you will spend* for this period." + bar earned/spent vs budgeted +
  "RpX budgeted savings".
- Tabel: **Category · Budget · Amount · Roll Up**. Budget bisa **per-minggu** (Rp75/wk)
  / per-periode (cadence per kategori). Kolom **Roll Up** = rollover. Folder kategori
  expandable.
- Freemium: "Free plan 12 budgets/categories. Upgrade…" (gating).
- → Pelajaran: **auto-budget dari histori** (buat onboarding "saranin budget dari
  3 bulan terakhir"), **verdict bahasa manusia** soal kesehatan budget, cadence
  per-kategori, rollover.

---

# PUTARAN 2b — dari sumber publik (method/help-docs/feature pages)

## YNAB — "The Four Rules" / metode
- Inti: **Give Every Dollar a Job** + 5 pertanyaan pemandu: Reality ("uang ini harus
  ngapain sampai gajian lagi?"), Stability ("pengeluaran besar tak rutin apa yg perlu
  disiapin?" → pecah jadi cicilan bulanan), Resilience ("sisihin buat bulan depan" →
  **get a month ahead**), Creation ("tujuan apa yg diprioritasin?"), Flexibility
  ("sesuaikan tanpa rasa bersalah").
- Filosofi: budgeting = **rencana proaktif**, bukan pembatasan; intensional, anti-guilt.
- → Pelajaran copy/onboarding: framing pertanyaan, bukan angka mentah. Pecah biaya
  tahunan jadi bulanan. Target "1 bulan di depan" sbg milestone.

## Monarch — budgeting (feature page)
- **DUA MODE**: **Flex Budgeting** (cuma Tetap/Fleksibel/Non-bulanan, pantau SATU
  angka = pengeluaran fleksibel — buat yg mau simpel) vs **Category Budgeting**
  (granular per kategori). → lever simplicity. Klunting bisa nawarin 2 mode.
- Rollover non-bulanan, progress bar visual, emoji ikon + reorder, widget iOS.

## Monarch — transaksi (help docs) ⭐ power tools
- **Rules**: kriteria (merchant/amount/dll) → rename merchant / set kategori / add
  tag / **hide**. Jalan tiap transaksi baru, **berurutan**.
- **Split + Smart Split**: 1 transaksi → beberapa sub-transaksi (kategori beda);
  auto-split by rule, **by amount atau %**. (1 struk Indomaret → groceries + rumah tangga.)
- **Bulk edit** banyak transaksi sekaligus (merchant/kategori/tanggal/notes/attachment).
- **Merchant merge** (gabung variasi nama merchant).

## Lunch Money (features/blog)
- **Tags** ⭐ — beda dari kategori: tiap transaksi 1 kategori, tapi bisa banyak **tag**.
  Buat lacak hal **lintas-kategori** (mis. "Lebaran", "Liburan Bali", "Renovasi")
  yg nyebar di banyak kategori. **Color-coded**. Klunting belum punya.
- Custom budget period sesuai jadwal gajian. Multi-currency 160+ + **FX historis
  per transaksi**. Crypto, net worth, **API developer**, **financial coach directory**.
- Update 2025: budgeting redesign + rollover, calendar lebih detail, biometric login.

## PocketSmith (features)
- Forecast saldo harian **sampai 60 tahun** ke depan. **What-if scenarios** ("test
  keputusan, lihat hasil masa depan"). Budget calendar = jadwalin bill/budget di
  kalender. Horizon budget fleksibel (harian/mingguan/bulanan). Net worth termasuk
  properti & KPR.

## Onboarding — best practice (artikel UX + perbandingan)
- **Progressive disclosure**: minta seperlunya, saat dibutuhkan, **jelasin kenapa**.
- **Journey**: welcome personal → **saran tujuan pertama** → tutorial in-app → reward.
- Jangan form panjang. **YNAB onboarding curam** (berjam-jam, spreadsheet-y);
  **Monarch cepat** (~30 menit, "connect & observe" dulu, budget belakangan).
- → Klunting: wizard **ringan + skippable + jelasin kenapa + saran tujuan/auto-budget**.
  Sediakan jalur "lihat-lihat dulu" (isi 1 akun, eksplor) sebelum maksa budget.

---

# PUTARAN 3 — onboarding flow, pricing, pain-points

## YNAB — Ultimate Get Started Guide (4 langkah, ~20–30 mnt)
1. **Build template**: customize kategori pre-built, tambah non-bulanan, set target.
   UX: "gak usah mikirin semua biaya sekarang, tambah sambil jalan. Pakai Beginner
   Template."
2. **Collect your cash**: tambah checking/savings/kartu kredit + saldo. UX: "mulai
   dari rekening paling sering dipakai; cuma masukin uang yg KAMU PUNYA sekarang."
3. **Give every dollar a job**: alokasiin semua uang via 5 pertanyaan.
4. **Record transactions**.
→ Pola wizard kita (B): template kategori → akun+saldo → alokasi → transaksi pertama.

## Pricing ke-4 app (per 2026) — buat kalibrasi monetisasi Klunting
| App | /tahun | /bulan | Trial | Free plan |
|---|---|---|---|---|
| YNAB | $109 | $14.99 | 34 hari | ❌ (student $4.99/bln) |
| Monarch | ~$100 | ~$8.33 | 7 hari | ❌ |
| Lunch Money | **$40–150 bayar-sesukamu** | $10 | 30–60 hari | ❌ |
| PocketSmith | ~$120 (Foundation) / Flourish $16.66 / Fortune $26.66 /bln | $9.99+ | — | ✅ (terbatas, selamanya) |
- Range ~$40–120/thn = **Rp 650rb–1,9jt/thn** → **kemahalan buat pasar ID**.
- Model menarik: **PocketSmith free-plan + tier**, **Lunch Money pay-what-you-want**.
- → Klunting: **freemium / harga ID-friendly** (mis. gratis core + Pro Rp 25–50rb/bln,
  atau pay-what-you-want). Trial 14–30 hari. Jangan tiru harga dolar mereka.

## PAIN POINTS (Monarch) = PELUANG Klunting ⭐
Keluhan user Monarch (Trustpilot/Reddit/PissedConsumer):
- Bank-sync **gak reliable**; **transaksi ke-auto-delete**; UI kadang ngebug.
- **"Useless outside USA — no banking connections, no currency conversion."**
- Billing: **double-charge, susah cancel trial, refund lama**.
- Support **cuma AI**, susah ketemu manusia.
- **Gak bisa print/share/export**. Investment tracking lemah.
→ **Posisi menang Klunting:** (1) **ID-native + IDR + manual-first** = justru cocok
  buat pasar yg sync-bank-nya ribet; manual = **gak ada sync rusak / tx ke-delete**.
  (2) **Billing transparan + gampang cancel**. (3) **Export/print** (UU PDP udah ada).
  (4) Support manusiawi. (5) Harga wajar ID. Manual-first = FITUR, bukan kekurangan.

## PAIN POINTS lain
- **YNAB**: learning curve **2–4 bulan** sampai "ngeh"; handling **kartu kredit
  membingungkan** ("budget = plan, spent = lain"); $109 mahal; sebagian rage-quit
  ("unnecessarily complicated"). → Klunting: **zero-based OPSIONAL + lebih simpel**,
  jangan paksa jargon, kurva belajar landai.
- **PocketSmith**: **mobile app terbatas** (gak bisa split/rule/lihat tx per kategori
  di HP), integrasi bank terbatas, feed gak reliable, learning curve, support
  ngedeflect ke help, free plan cuma 2 akun. → Klunting: **mobile (PWA) setara
  desktop**; manual = bebas masalah feed.

## YANG DISUKAI user (pertahankan di Klunting)
Net worth overview · dashboard bersih · goals · **auto-kategori** · sync cross-device ·
zero-based (buat yg mau) · analitik/laporan · edukasi/support · multi-account overview.

## SINTESIS STRATEGIS (positioning Klunting)
Keluhan **berulang di SEMUA app**: (1) bank-sync rapuh, (2) learning curve, (3)
mahal (dolar), (4) lemah di luar US / no multi-currency. **Klunting kebetulan
ngejawab keempatnya**: manual-first (no sync rapuh) + IDR-native + lebih simpel +
harga ID. Narasi: **"Aplikasi keuangan yg ngerti orang Indonesia — gak ribet
konek bank, gak mahal, gak ke-reset sendiri."** Yg disukai (net worth, dashboard,
goals, auto-kategori) tetap dijaga.

---

# PUTARAN 3b — PASAR INDONESIA (paling relevan buat Klunting)

## Pemain lokal/populer di ID
- **Money Lover** — populer, multi-currency, **pengingat tagihan**, UI ramah pemula.
- **Finansialku** — **lokal**, konten disesuaikan kondisi ID, planning + **edukasi
  finansial** + pencatatan + budgeting + laporan, juga buat usaha kecil.
- **Wallet (BudgetBakers)** — sync rekening bank, analisis pengeluaran detail.
- **Spendee** — fokus **visualisasi warna-warni** (grafik/diagram).
- **Finku** — terlengkap: auto-record, budgeting, **daily check-in (bangun
  kebiasaan)**, **sync rekening & e-wallet otomatis**, rekomendasi saving goal,
  **berizin OJK** (jual kepercayaan).
- Bank digital (**Jenius, Jago**) punya budgeting bawaan + sync.

## Kebiasaan finansial ID (data 2024)
- **Paylater dominan**: ~50% pengguna = milenial/Gen Z; buat elektronik/fashion/
  makanan; **literasi rendah → sering impulsif** (gak ngeh bunga/cicilan).
- **E-wallet ubiquitous**: OVO, GoPay, DANA, ShopeePay, LinkAja (bayar, QRIS,
  paylater, investasi).
- Yg dicari: kategori pengeluaran jelas, **budget limit + notifikasi**, sync
  semi-otomatis, **daily check-in habit**, **trust (OJK/keamanan data)**.

## Wedge Klunting (kesimpulan market)
**UX premium ala app global (YNAB/Monarch) + ID-native.** Yg bikin beda dari
pesaing lokal: desain premium + audit-grade + Claude AI. Yg bikin beda dari app
global: IDR, e-wallet/paylater first-class, manual-first (anti sync-rusak), kategori
lokal, harga wajar. **Tidak ada pesaing yg "premium global UX × ID-native" sekaligus.**

---

# PUTARAN 4 — Actual Budget (open-source, "YNAB gratis")

Repo: github.com/actualbudget/actual (~26.8k stars, MIT). Local-first, NodeJS/TS
(loot-core platform-agnostic + Electron desktop + sync element CRDT-ish), self-host
(~$1.4/bln PikaPods) atau desktop. **Privacy-first, gratis.**

### Metode budgeting = ENVELOPE
- "**Budget cuma uang yg KAMU PUNYA sekarang**" (bukan forecast). Beda dari Klunting
  (kita plan-ahead tahunan). Bisa jadi MODE opsional, bukan pengganti.
- **To Budget** = uang belum dialokasi → tujuannya nol-kan (zero-based, kayak YNAB).
- Kategori = "amplop" (saldo berjalan).
- **Overspending**: defisit kategori **otomatis di-roll ke "To Budget" bulan depan**
  (maksa kamu nutup dari suatu tempat) — atau **"Rollover overspending"** biar saldo
  negatif kebawa antar bulan (buat reimbursable).
- **Transfer antar kategori** (rebalance tanpa ganggu transaksi).
- **"Hold for next month"** (tahan income buat bulan depan — "live on last month's income").

### ⭐⭐ Goal Templates — fitur paling layak dicontek (versi terstruktur)
Bahasa deklaratif di catatan kategori yg **auto-isi budget sekali klik**:
- `#template 50` = 50/bln · `#template up to 150` = **refill sampai 150** ·
  `#template 50 up to 100` = isi 50, cap 100.
- `#template 10000 by 2025-12` = **nabung sampai tanggal** (bagi rata sisa bulan).
- `#template 500 by 2025-03 repeat every year` = tahunan berulang.
- `#template 10 repeat every 2 weeks starting ...` = **per 2 minggu**.
- `#template 10% of all income` / `15% of previous all income` = **% income**
  (yg "previous" = month-ahead).
- `#template schedule Internet` = ikut **jadwal/recurring**.
- `#template average 3 months [increase 20%]` = **rata-rata histori** (= auto-budget
  per-kategori, deklaratif!).
- `#template remainder` / `remainder 2` = **bagi sisa** (berbobot).
- Indikator warna: **hijau (target tercapai) / oranye (belum) / merah (negatif)**.
  Priority `-X` buat urutan.
→ Ini **gabungin YNAB Targets + auto-budget + rollover goal** jadi SATU sistem
  ekspresif — paling kaya dari semua app. Klunting ambil **konsep mode-nya**
  (pakai picker terstruktur, bukan teks mini-language biar tetap premium/simpel).

### Take vs Skip
- **TAKE**: (1) **Goal-template MODES** sbg picker target per-kategori (Fixed /
  Refill up-to / Save by date / Every-N / % income / Average-N-bulan / Remainder) —
  upgrade rec C5 & gabung rec L. (2) **Overspending rollover** (defisit → bulan depan)
  buat view bulanan. (3) **Transfer antar kategori** + **Hold income**. (4) **Indikator
  warna** target. (5) Adanya "YNAB gratis OSS" → **perkuat narasi**: harga wajar,
  ekspor data, no lock-in, privacy.
- **SKIP**: self-host / Electron / CRDT local-first (Klunting = Next.js+Supabase
  hosted PWA, gak usah re-arsitektur). Teks mini-language (power-user → kita pakai UI
  picker). Envelope "cuma uang yg ada" sbg satu-satunya mode (kita plan-ahead; envelope
  jadiin opsional aja).
