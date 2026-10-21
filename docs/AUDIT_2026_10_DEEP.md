# Audit Mendalam Klunting: Keamanan + Kebenaran Angka (Okt 2026)

Branch `audit/2026-10` (lanjutan dari `docs/AUDIT_2026_10.md`). Migrasi **069** dan **070** ditulis tapi **BELUM DITERAPKAN**. Tidak di-merge, tidak di-deploy.

Verifikasi akhir: `npm run build` lulus (Next 16.3.8), `vitest` 38 berkas / **406 tes lulus** (sebelumnya 359), `tsc` bersih, `eslint` 0 error.

---

## A1. RLS per tabel (migrasi 001–068, state final)

Metode: baca semua `create policy` / `drop policy` / `enable row level security` / `security definer` sampai 068. **DB live tidak dicek.** Catatan: policy UPDATE yang hanya punya `USING` tetap aman, karena Postgres memakai USING sebagai WITH CHECK. Celah muncul di policy household yang tidak mengunci `user_id`.

### A1.1 Tabel

| Tabel | Status | Masalah | Perbaikan |
|---|---|---|---|
| profiles | OK | UPDATE own; `ai_credits`/`renewal_at` di-pin trigger 024 (invoker). Tidak ada kolom plan/is_admin. `welcomed_at` bisa di-null-kan sendiri (P3, cuma email ke diri sendiri) | — |
| accounts | Masalah | UPDATE household (041) tanpa cek user_id, jadi `user_id` bisa di-set ke UUID korban (injeksi baris ke data korban) | 069 §3 |
| transactions | Masalah | Sama dengan accounts. Form edit juga mengirim `user_id: user.id`, sehingga kepemilikan baris household anggota lain diam-diam berpindah | 069 §3 |
| budgets | Masalah | Sama. Ditambah DoS: unique (user_id,year,month,category,type) bisa diisi duluan untuk korban | 069 §3 |
| goals | Masalah | Sama (042) | 069 §3 |
| assets_liquid | OK | CRUD own | — |
| assets_non_liquid | OK | CRUD own | — |
| investments | OK | CRUD own | — |
| debts | OK | CRUD own; `remaining` via RPC 065 | — |
| emergency_funds | OK | CRUD own | — |
| emergency_fund_locations | OK | via kepemilikan fund (USING = CHECK) | — |
| emergency_fund_transactions | OK | via kepemilikan fund | — |
| transfers | OK | CRUD own | — |
| debt_payments | OK | CRUD own (FK debt_id tidak divalidasi pemilik, P3 integritas, tanpa kebocoran) | — |
| credit_cards | OK | CRUD own | — |
| credit_card_payments | OK | S/I/D own, tanpa UPDATE | — |
| recurring_transactions | OK | FOR ALL own + check | — |
| dividends | OK | FOR ALL own + check | — |
| net_worth_snapshots | OK | FOR ALL own; agregat household lewat RPC 044 | — |
| categorization_rules | OK | FOR ALL own | — |
| stock_transactions | OK | FOR ALL own | — |
| contracts | OK | CRUD own | — |
| account_allocations | OK | FOR ALL own + check | — |
| watchlist | OK | CRUD own | — |
| portfolio_snapshots | OK | S/I/U own | — |
| budget_categories | OK | CRUD own | — |
| push_subscriptions | OK | S/I/D own | — |
| notifications | OK | SELECT + UPDATE own (check), insert service-role | — |
| security_events | OK* | INSERT own dari client (lib/security-events.ts), user bisa memalsukan log miliknya sendiri (P3, by design) | — |
| xp_events | OK* | INSERT own oleh client; XP belum dipakai app (P3). Tanpa U/D | — |
| achievements | OK* | INSERT own oleh client (P3). Tanpa U/D | — |
| plans | OK | SELECT authenticated; tidak ada write | — |
| subscriptions (billing) | OK | Policy write 036 sudah di-drop 052/057 + revoke. Sisa SELECT own (2 policy duplikat, tidak berbahaya) | — |
| ai_credit_ledger | OK | SELECT own saja | — |
| billing_events | OK | RLS on, tanpa policy, write di-revoke | — |
| research_generation_claims | OK | RLS on, tanpa policy | — |
| reminder_log | OK | RLS on, tanpa policy | — |
| price_snapshots | OK | read authenticated; write service_role (055 revoke) | — |
| price_history | OK | write authenticated di-drop 057; read authenticated | — |
| stock_research_cache | Masalah (P3) | Write sudah dikunci 055, tapi `generated_by` (UUID user) terbaca semua user login, yang jadi bahan serangan §3 | 069 §6 |
| households | Masalah | Owner bisa INSERT/UPDATE `max_seats` bebas, jadi bisa lewati batas kursi | 069 §5 |
| household_members | Masalah | INSERT self-join sudah ditutup 041. Tapi UPDATE owner tanpa batas kolom: `user_id` bisa diganti UUID korban, sehingga korban dipaksa masuk household dan transaksi/rekening barunya ter-tag household (terbaca owner) | 069 §2 |
| household_invitations | Masalah | Policy baca-token 015 sudah di-drop 028. Tapi UPDATE `or accepted_by = auth.uid()`: penerima bisa menulis ulang undangan (household_id korban, status pending), lalu akun lain accept dan masuk household korban. Token juga terbaca semua anggota, bukan cuma owner (P3) | 069 §1 |
| household_activities | OK | SELECT member; INSERT self + member; immutable | — |
| storage.objects (receipts) | OK | folder `<uid>/` untuk S/I/U/D | — |

### A1.2 Fungsi SECURITY DEFINER

| Fungsi | search_path | Cek pemilik | Grant | Status |
|---|---|---|---|---|
| handle_new_user() | public (068) | trigger | revoke anon/public (023) | OK |
| is_household_member(uuid) | public, pg_temp | auth.uid() | revoke anon | OK |
| current_household_id() | public, pg_temp | auth.uid() | revoke anon | OK |
| can_member_write(uuid) | public (068) | auth.uid() | default (anon dapat false) | OK (sengaja, dipakai RLS) |
| accept_household_invitation(text) | public, pg_temp | token + belum member + kapasitas | authenticated | OK* (race kapasitas tanpa lock, P3. Celah via §1 ditutup) |
| get_household_invitation(text) | '' | exact token, tanpa token di output | authenticated | OK |
| set_my_net_worth_sharing(bool) | public (068) | `where user_id = auth.uid()` | default (anon no-op) | OK |
| get_household_net_worth(uuid) | public, pg_temp | cek member | authenticated (049) | OK |
| get_household_directory(uuid) | public, pg_temp | cek member | authenticated | OK |
| consume_ai_credits(uuid,int) | '' | role=authenticated wajib uid sendiri | service_role saja (026) | OK (pastikan 026 sudah diterapkan di prod) |
| refund_ai_credits(uuid,int) | '' | sama | service_role saja (026) | OK (idem) |
| reset_ai_credits_if_due(uuid) | '' | sama | service_role saja (026) | OK (idem) |
| ai_credit_status(uuid) | '' | uid ketat | authenticated | OK |
| adjust_credit_card_balance | public | `user_id = auth.uid()` | authenticated | OK |
| adjust_account_balance | public | pakai is_household_member, sehingga anggota view-only bisa ubah saldo | authenticated | Masalah, diperbaiki 069 §4 (can_member_write) |
| adjust_debt_remaining | public | `user_id = auth.uid()` | authenticated | OK |
| category_usage() | public | `user_id = auth.uid()` | authenticated | OK |
| guard_profile_billing_columns() | '' | sudah INVOKER (024) | revoke semua | OK |
| (baru) pin_row_owner() | '' | INVOKER, trigger | revoke semua | 069 |

Fungsi non-definer (`touch_updated_at`, `enforce_owner_can_edit`, `get_my_xp`) tidak berisiko.

### A1.3 Temuan RLS → perbaikan

| Prio | Temuan | Perbaikan |
|---|---|---|
| P1 | Penerima undangan bisa menulis ulang undangan bekas (`household_id` korban, status pending), lalu akun kedua bergabung ke household korban | 069 §1 (UPDATE undangan hanya untuk owner) |
| P1 | Owner bisa mengganti `household_members.user_id` sehingga user lain dipaksa masuk household, dan transaksi barunya ter-tag household | 069 §2 (grant UPDATE hanya kolom `can_edit`, `relationship`) |
| P1 | Policy UPDATE household di accounts/transactions/budgets/goals tidak mengunci `user_id`, sehingga orang lain bisa menyisipkan baris palsu ke data korban. Form edit juga mengirim `user_id` sehingga kepemilikan diam-diam berpindah | 069 §3 (trigger `pin_row_owner`) + `0c0c6ba` (client tidak mengirim `user_id` saat edit) |
| P1 | 2FA bisa dilewati lewat PostgREST langsung (sesi AAL1 + anon key) | 070 §1 (policy RESTRICTIVE aal2) + `ab867f9` (halaman print) |
| P2 | Anggota view-only bisa mengubah saldo rekening bersama via `adjust_account_balance` | 069 §4 |
| P2 | Owner bisa menaikkan `households.max_seats` | 069 §5 |
| P2 | FK `generated_by` / `accepted_by` tanpa ON DELETE membuat hapus akun gagal | 070 §2 (route juga sudah mengakalinya) |
| P2 | Bucket `receipts` tanpa batas ukuran/tipe | 070 §3 |
| P3 | `stock_research_cache.generated_by` membocorkan UUID user | 069 §6 |
| P2 (lapor) | RLS tidak memvalidasi kepemilikan FK (`transactions.account_id`, `recurring_transactions.account_id`, dst.) | Cron sudah ditambal (`843e984`); policy WITH CHECK FK menyusul |

---

## A2. Otorisasi API route

| Route | Metode | Auth | Admin client? | Cek kepemilikan ID | Status | Catatan |
|---|---|---|---|---|---|---|
| `/api/billing/checkout` | POST | getUser (404 bila `NEXT_PUBLIC_BILLING_ENABLED`≠1, 503 bila `BILLING_ENABLED`≠true) | Tidak | Tidak ada ID dari client; harga dari `PLAN_PRICES` server; `user_id` dari sesi ke metadata | DIPERBAIKI | Dulu redirect URL sukses memakai header `Origin` (bisa dipalsukan) → kini `trustedOrigin()` dari env. |
| `/api/billing/webhook` | POST | Header `x-callback-token` (Xendit, compare XOR loop) | Ya (wajib) | user/plan dari metadata invoice (diisi server saat checkout) | DIPERBAIKI | (a) Dulu: event dicatat di `billing_events` lalu aktivasi gagal → 500 → retry Xendit kena dedup 23505 → bayar lunas tapi paket TIDAK aktif. Kini baris event dihapus saat gagal agar retry jalan. (b) Tambah cek `amount ≥ PLAN_PRICES[plan][period]`. Sisa: compare token bocorkan panjang (P3, `src/lib/billing/xendit.ts:16`); tidak re-fetch invoice ke API Xendit (P3). |
| `/api/cron/net-worth-snapshot` | GET | CRON_SECRET (kini constant-time `verifyCronAuth`) | Ya | Tidak ada input | DIPERBAIKI | Query admin lintas user kini paginated (dulu > 1000 baris membuat snapshot sebagian user salah); rumus kanonik `computeNetWorth`. |
| `/api/cron/portfolio-snapshots` | GET | CRON_SECRET (kini constant-time) | Ya | Tidak ada input | DIPERBAIKI | `verifyCronAuth`. Query `investments` tanpa paginasi (P2). |
| `/api/cron/post-recurring` | GET | CRON_SECRET (kini constant-time) | Ya | `account_id` dari recurring kini divalidasi milik `user_id` yang sama | DIPERBAIKI | RLS recurring tidak cek kepemilikan `account_id` → dulu cron (service-role) bisa insert transaksi menunjuk rekening user lain. Kini item seperti itu dilewati + dicatat di `errors`. Tanpa paginasi (P2). |
| `/api/cron/push-reminders` | GET | CRON_SECRET (kini constant-time) | Ya | Nama akun di notifikasi kini hanya bila `accounts.user_id === recurring.user_id` | DIPERBAIKI | Dulu nama rekening user lain bisa bocor ke push notif lewat `account_id` silang. |
| `/api/cron/reminders` | GET | CRON_SECRET (kini constant-time) | Ya | — | DIPERBAIKI | Juga di-skip bila billing beku. |
| `/api/cron/watchlist-alerts` | GET | CRON_SECRET (kini constant-time) | Ya | — | DIPERBAIKI | — |
| `/api/delete-account` | POST | getUser + step-up 2FA bila enroll (`needsStepUp`) | Ya bila ada (fallback user client) | Semua delete `.eq('user_id', user.id)` dari sesi | DIPERBAIKI | Lihat §3. Tambah `push_subscriptions`, `notifications`, `reminder_log`; null-kan FK tanpa `ON DELETE` (`stock_research_cache.generated_by`, `household_invitations.accepted_by`) yang dulu membuat `auth.admin.deleteUser` GAGAL; paginasi hapus storage (dulu cuma 100 file pertama). Tidak ada re-auth password (P2, lihat §5). |
| `/api/export-data` | GET | getUser + step-up 2FA | Tidak (RLS) | Kini filter pemilik eksplisit per tabel | DIPERBAIKI | Dulu `select('*')` tanpa filter → policy SELECT household ikut mengekspor accounts/transactions/budgets/goals ANGGOTA LAIN. Tambah tabel yang hilang (lihat §3). |
| `/api/extract-receipt` | POST | getUser + aiRateLimit | Tidak (kredit via admin di lib) | Tidak ada ID; tidak menyimpan ke storage | DIPERBAIKI | Magic-byte kini wajib (dulu fallback ke `file.type` client); cek `Content-Length` sebelum `formData()`; kredit dipotong SETELAH validasi (dulu 400 tidak di-refund); output model disanitasi. |
| `/api/parse-transaction` | POST | getUser + aiRateLimit | Tidak | Tidak ada ID | DIPERBAIKI | Gratis by design (tanpa kredit). Output model kini disanitasi (enum, amount clamp, panjang string). Tidak ada eksekusi aksi/DB-write dari output — client preview → user simpan via RLS. |
| `/api/import-mutasi` | POST | getUser + aiRateLimit | Tidak | Rules dibaca `.eq('user_id', user.id)` | DIPERBAIKI | Output disanitasi (baris invalid dibuang, cap 2000 baris, tanggal/amount/enum); cek `Content-Length`. Insert massal dilakukan client via RLS setelah konfirmasi. |
| `/api/insights` | POST | getUser + aiRateLimit | Tidak | Tidak ada ID (data ringkasan dikirim client) | DIPERBAIKI | Array/string body dulu tanpa batas → prompt bisa ratusan ribu token & field hilang bikin `.toFixed()` crash setelah kredit dipotong. Kini dibatasi & dinormalkan. |
| `/api/playbook` | POST | getUser + aiRateLimit | Tidak | slug → whitelist `getPlaybook` | DIPERBAIKI | Nilai select di luar opsi / angka non-finit dulu masuk prompt sebagai teks bebas; `today` divalidasi ISO; body null tidak lagi 500. |
| `/api/idx-research/[ticker]/generate` | POST | getUser + aiRateLimit | Ya (cache shared + claim) | ticker → kini regex `^[A-Z0-9]{1,12}$` | DIPERBAIKI | Ticker mentah dulu langsung ke `getStock()` → `path.join(STOCK_DIR, t+'.json')` (path traversal terbatas huruf besar + negative-cache tak terbatas). `?force=1` boleh dipakai siapa saja untuk regenerasi cache shared (dibatasi aiRateLimit; P3). |
| `/api/idx-research/[ticker]` | GET | Publik | Tidak | ticker → kini regex | DIPERBAIKI | Data pasar statis. |
| `/api/idx-research` | GET | Publik | Tidak | — | OK | Data pasar statis. |
| `/api/idx-dividends` | GET | Publik | Tidak | — | OK | Lookup in-memory. |
| `/api/idx-emiten` | GET | Publik | Tidak | — | OK | — |
| `/api/screener` | GET | Publik | Tidak | — | OK | — |
| `/api/gold-price` | GET | Publik | Tidak | — | OK (P3) | Upstream tak resmi `logam-mulia-api.iamutaki.workers.dev` → integritas harga bergantung pihak ketiga. |
| `/api/crypto-chart` | GET | **Publik** | Tidak | symbol → kini regex `^[A-Z0-9]{1,20}USDT$` | TEMUAN (P2) | Simbol fiktif dari anonim → error Binance → circuit breaker `binance` (5 gagal → buka 30 dtk, `src/lib/retry.ts:120`) → harga kripto user lain di instance itu ikut mati. Usul: breaker hanya hitung 5xx/network, atau auth-gate route ini. |
| `/api/crypto-price` | GET | getUser | Tidak | — | OK | — |
| `/api/crypto-symbols` | GET | getUser | Tidak | — | OK | — |
| `/api/stock-chart` | GET | getUser | Tidak | ticker di-`encodeURIComponent` ke host tetap Yahoo | OK | Bukan SSRF (host tetap). |
| `/api/quotes` | GET | getUser | Ya (tulis `price_snapshots` shared) | — | DIPERBAIKI | Dulu jumlah/format ticker tak dibatasi (fan-out Yahoo + sampah di cache shared) dan harga 0 ikut di-cache untuk semua user. Kini max 100 ticker, regex format, price>0. |
| `/api/news` | GET | getUser | Tidak | — | OK | — |
| `/api/household/invite` | POST | getUser + rate limit 5/jam | Tidak (RLS) | `invitationId` → dicek `households.owner_user_id === user.id` | DIPERBAIKI | Link undangan dulu dibangun dari header `Origin` → owner bisa kirim email resmi Klunting berisi link domain phishing ke alamat sembarang. Kini `trustedOrigin()`. |
| `/api/push/subscribe` | POST/DELETE | getUser | Ya (hanya saat konflik endpoint) | DELETE: RLS own-only. POST: endpoint kini allowlist host push | DIPERBAIKI | (a) Endpoint `https://` sembarang → server cron POST ke URL itu = blind SSRF → kini allowlist FCM/Mozilla/Apple/WNS. (b) `upsert onConflict` butuh policy UPDATE yang tidak ada (063) → re-subscribe selalu gagal; kini delete+insert; endpoint milik user lain (device bergantian) dialihkan via admin. |
| `/api/health` | GET | Publik | Ya (HEAD count `plans`) | — | OK | Tidak bocor data. |
| `/auth/callback` (bukan /api) | GET | OAuth code exchange | Tidak | `next` disanitasi (path internal) | OK | Redirect selalu `${origin}${next}` → aman dari open redirect. |

**Kesimpulan IDOR:** tidak ditemukan route di mana user A bisa membaca/mengubah data user B dengan menukar ID. Semua route user memakai client RLS atau `.eq(..., user.id)`; route admin hanya cron (tanpa input) + webhook (metadata server). Kebocoran lintas-tenant yang ada berasal dari **RLS yang tidak memvalidasi FK** (`account_id` dsb. di recurring/transactions) yang lalu dibaca cron service-role — sudah ditambal di sisi cron; akar masalah perlu migrasi (§5).

### A3. Klien, header, Sentry

- Semua `NEXT_PUBLIC_*` aman dipublikasikan (URL/anon key Supabase, site URL, DSN Sentry, VAPID public, flag). Modul yang membaca secret memakai `import 'server-only'`.
- Proxy/middleware: prefix seperti `/about` juga meloloskan `/aboutx` (P3). Dampaknya nihil karena halaman privat mengecek auth sendiri di server (dashboard layout, print, onboarding).
- CSP sudah ditegakkan, tetapi `script-src 'unsafe-inline'` (P2, lapor: perlu nonce + `strict-dynamic`). Header lain lengkap (HSTS, XFO, nosniff, Referrer, Permissions).
- Sentry: `sendDefaultPii:false`, tanpa Replay, `beforeSend` membersihkan data. **Ditambah** `beforeBreadcrumb` yang membuang console dan memotong query string URL (`860c1c6`).
- Upload `extract-receipt`: cek magic bytes + ukuran sebelum buffer; kredit dipotong setelah validasi.
- Prompt injection: output model untuk parse-transaction, struk, dan mutasi disanitasi (enum, clamp amount, tanggal valid, panjang string, maks 2000 baris). Tidak ada aksi atau DB-write yang dijalankan langsung dari output model; semua lewat preview, lalu disimpan user via RLS.

### A4. Data pribadi: cakupan ekspor dan hapus akun

| Tabel | Kolom pemilik | Export (sebelum → sesudah) | Delete (sebelum → sesudah) | FK ke auth.users | Catatan |
|

PII di log: tidak ada email, nominal, deskripsi, atau token yang di-log; log hanya berisi `user_id` + pesan error. Sisa P3: objek error SDK Anthropic di-log utuh, dan `billing_events.payload` menyimpan `payer_email` setelah akun dihapus (keputusan retensi pemilik).

---

## B. Kebenaran angka uang

### B1. Net worth: satu rumus

`src/lib/data/net-worth.ts` → `computeNetWorth({ liquid, nonLiquid, investments, debts, creditCards })`, dipakai di dashboard (+ hero), Akun, Net Worth (tampilan + snapshot client), laporan bulanan, dan cron snapshot. Household membaca snapshot. Rumusnya sama dengan yang lama, jadi angka untuk data yang sama tidak berubah. Bug yang ditemukan sekaligus diperbaiki:

| Bug | Dampak | Perbaikan |
|---|---|---|
| Cron `net-worth-snapshot` memilih 6 tabel **lintas semua user** tanpa paginasi | Begitu total baris > 1000, aset/utang sebagian user terpotong, sehingga snapshot (dan net worth household) salah | `fetchAllRows` per tabel (`78f4cdf`) |
| Net Worth / Akun / laporan tidak mengecek error query investasi & kartu | Gagal muat jadi 0 diam-diam; halaman Net Worth bahkan **menulis snapshot palsu** ke DB | throw → kartu error (`78f4cdf`) |
| Laporan bulanan menarik transaksi 6 bulan tanpa paginasi, urut amount desc | > 1000 baris: transaksi terkecil hilang, total bulan kurang | paginated (`78f4cdf`) |

Arus bulanan juga dibuat kanonik: `src/lib/data/flow.ts` (`monthFlow`, `inMonth`, `monthBounds`, exclude Transfer di semua tipe) dipakai dashboard dan laporan.

### B2. Skenario angka (`src/lib/data/scenarios.test.ts`, 24 tes, semua lulus)

| Skenario | Hasil |
|---|---|
| Net worth kanonik; dashboard (utang + kartu digabung) = rincian halaman Net Worth | ✅ sama |
| Transfer antar-rekening: kedua kaki tidak menggelembungkan income/expense; Forecast Saldo dan income Goals memakai aturan yang sama | ✅ |
| Bayar kartu penuh / sebagian: rekening −X, kartu −X, net worth tetap | ✅ |
| Bayar kartu gagal di langkah kartu: rekening dikembalikan via delta (tanpa tulis absolut) | ✅ (diperbaiki `b52e423`) |
| Bayar kartu dibatalkan: kembali ke semula | ✅ |
| Bayar kartu **melebihi** outstanding lalu dibatalkan | ⚠️ outstanding jadi lebih besar dari semula (clamp 0 tidak tercatat). Dilaporkan; perbaikan perlu kolom `applied_amount` (migrasi + perubahan perilaku) |
| Bayar utang + cicilan: `remaining` turun (clamp 0); rekening tidak disentuh (kebijakan AGENTS.md → net worth naik sampai saldo disesuaikan manual) | ✅ sesuai kebijakan |
| Import mutasi ke kartu: expense menaikkan outstanding, income/refund tidak; ke rekening: tanpa delta | ✅ |
| Format angka bank (`1.234.567`, `Rp 25.000,00`) | ✅ |
| WIB: transaksi tanggal 1 pukul 01:30 WIB | ✅ setelah perbaikan. **Bug:** 31 form/default memakai `toISOString()` (UTC), sehingga transaksi pukul 00:00–06:59 WIB tercatat kemarin dan pada tanggal 1 masuk ke bulan lalu. Diperbaiki ke `toLocalISO` (`c9c2b62`) |
| Pergantian Des → Jan | ✅ |
| Pembulatan: 1000 × Rp 33.333 eksak | ✅ |
| > 1000 transaksi: total tahunan & per bulan dari paginasi = total sebenarnya | ✅ |
| Anggaran: realisasi lintas halaman, sisa = anggaran − realisasi; gagal muat → error | ✅ (diperbaiki `78f4cdf`) |
| Goals: income exclude Transfer; gagal muat → error, bukan "belum ada pemasukan" | ✅ (diperbaiki `78f4cdf`) |

Konsistensi antar layar dijamin secara struktural: dashboard, halaman terkait, dan laporan sekarang memanggil fungsi yang sama (`computeNetWorth`, `monthFlow`/`sumFlow`, `balances.ts`), dan fungsi itulah yang dites.

### B3. Temuan P1/P2 dari audit ringan

- **Diperbaiki:** gagal muat yang tampil 0, yaitu actuals anggaran, income Goals, serta investasi/kartu di Net Worth, Akun, dan laporan (`78f4cdf`).
- **Diperbaiki:** pembatalan bayar kartu yang menulis saldo absolut, sekarang lewat `balances.ts` (`b52e423`).
- **Dilaporkan:** halaman Transaksi masih menarik semua transaksi sepanjang masa (benar tapi lambat). Perbaikan yang aman butuh paginasi server + filter periode, dan itu mengubah UX, jadi belum dilakukan.

### B4. Kontrak yang dijaga

`cashflow-forecast.ts` tidak diubah. Semantik `balances.ts` tidak berubah (hanya urutan langkah bayar kartu di pemanggil). Struktur Sankey hub dan Calm Mode tidak disentuh.

---

## C. Next 16.3 di Vercel

Next 16.3 menyalakan `turbopackFileSystemCacheForBuild` secara default (lihat `node_modules/next/dist/docs/.../turbopackFileSystemCache.md`), dan Vercel memulihkan `.next/cache` antar-deploy, persis kondisi CSS basi tersebut. Setelan sudah ditambahkan: `experimental.turbopackFileSystemCacheForBuild: false` (`2d0f573`). Diverifikasi: 15 kelas Tailwind arbitrer dari commit terbaru ada di CSS hasil build, dan kelas kontrol palsu tidak ada.

---

## Perbaikan (commit)

| Commit | Isi |
|---|---|
| `2d0f573` | Matikan cache FS Turbopack untuk build |
| `cda9c4a` | Migrasi 069 pengerasan RLS (BELUM DITERAPKAN) |
| `b52e423` | Bayar kartu: kompensasi lewat `balances.ts`, helper `card-payment.ts` + tes |
| `c9c2b62` | Tanggal lokal WIB di 31 tempat |
| `0c0c6ba` | Edit transaksi/goal tidak mengirim `user_id` |
| `78f4cdf` | Net worth + arus bulanan kanonik, gagal muat = error, paginasi cron/laporan, 24 skenario |
| `843e984` | Cron constant-time + cek kepemilikan akun, allowlist push, origin tepercaya, webhook retry + cek nominal |
| `35315f0` | Batas harian AI + sanitasi output model + validasi upload |
| `4c2e319` | Ekspor hanya milik user + hapus akun lengkap |
| `3a9f187` | Validasi ticker/simbol, harga 0 tidak di-cache |
| `ab867f9` | 2FA di halaman print |
| `8a027ab` | Migrasi 070 MFA via RLS, FK, bucket (BELUM DITERAPKAN) |
| `860c1c6` | Sentry `beforeBreadcrumb` |

## Perlu tindakan pemilik

1. **Verifikasi di prod** bahwa migrasi 026, 028, 052, 055, 057 benar-benar sudah diterapkan, karena beberapa ditandai "apply setelah deploy". P0 lama (self-join household, enumerasi token, tulis `subscriptions`, cache poisoning, RPC kredit AI) hanya tertutup kalau migrasi itu live. Cek: `select tablename, policyname from pg_policies where tablename in ('subscriptions','household_invitations','price_history','stock_research_cache');`
2. **Review lalu terapkan 069, kemudian 070**, dan jalankan checklist TEST di masing-masing file serta Supabase Security Advisor. 070 §1 akan memblokir akses data untuk sesi aal1 user ber-2FA; itu memang tujuannya, tapi uji alur login 2FA di preview dulu.
3. **Env produksi:** `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (wajib supaya hapus akun bisa menghapus user auth), `NEXT_PUBLIC_SITE_URL=https://klunting.com` (link undangan dan redirect pembayaran), opsional `AI_DAILY_LIMIT` (default 200/hari/user).
4. **Batas belanja di konsol Anthropic.** Cap harian AI masih in-memory per instance; cap di DB menyusul.
5. **Billing:** webhook sekarang menolak invoice yang nominalnya di bawah `PLAN_PRICES`. Kalau harga dinaikkan, invoice lama yang masih pending akan tertolak (tercatat di log), jadi tangani manual.

## Sisa temuan (belum diperbaiki)

- **P2:**
  - CSP `unsafe-inline`;
  - RLS belum validasi kepemilikan FK;
  - cron lain belum paginasi > 1000 (`portfolio-snapshots`, `post-recurring`, `push-reminders`, `watchlist-alerts`);
  - circuit breaker bisa dipicu dari route publik `crypto-chart` (`retry.ts` menghitung 4xx);
  - hapus akun tanpa re-autentikasi;
  - bayar kartu berlebih + batal melebihkan utang;
  - halaman Transaksi menarik semua data.
- **P3:**
  - prefix-match middleware;
  - compare token Xendit tidak constant-time;
  - push tetap terkirim setelah logout;
  - refund kredit gagal tidak tercatat;
  - `billing_events` menyimpan email;
  - file struk tidak ikut ekspor;
  - XP/achievements/security_events bisa di-insert sendiri.

## Ringkasan untuk pemilik

1. Tidak ditemukan P0: tidak ada route atau tabel tempat user A bisa membaca atau mengubah data user B dengan menukar ID.
2. Ada 4 celah P1 di household dan 2FA. Semuanya ditutup lewat migrasi 069/070 (belum diterapkan) plus perbaikan kode yang sudah masuk.
3. Angka uang yang salah dan sudah diperbaiki: transaksi pukul 00–07 WIB tercatat di tanggal kemarin, sehingga tanggal 1 masuk ke bulan lalu.
4. Snapshot net worth harian (cron) terpotong begitu total data melewati 1000 baris; halaman Net Worth bisa menyimpan snapshot palsu bernilai 0 saat query gagal.
5. Net worth kini dihitung di satu fungsi (`lib/data/net-worth.ts`) dan dipakai di semua layar.
6. Gagal muat sekarang tampil sebagai error, bukan angka 0 palsu, di anggaran, Goals, Net Worth, Akun, dan laporan.
7. Pembatalan bayar kartu sekarang lewat `balances.ts`. Ada 24 skenario uang yang dikunci tes; total tes 406, semua lulus, dan build lulus.
8. API: cron constant-time, batas harian AI, sanitasi output AI, ekspor/hapus akun lengkap dan hanya milik user, webhook retry, allowlist push.
9. Next 16.3: cache build Turbopack dimatikan agar CSS tidak basi di Vercel; sudah dicek bahwa kelas terbaru ada di CSS.
10. Langkah Anda: verifikasi migrasi lama di prod, terapkan 069 lalu 070, isi env (`CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`), dan pasang batas belanja Anthropic.
