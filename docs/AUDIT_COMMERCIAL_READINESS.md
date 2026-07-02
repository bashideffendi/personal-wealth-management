# Audit Kesiapan Produksi & Komersial — Klunting

Metode: 7 auditor paralel per-dimensi (baca file asli) → verifikasi adversarial tiap temuan Critical/High (skeptik yang tugasnya membantah) → sintesis. Auditor membaca kode + 56 migrasi SQL langsung. **Tidak bisa** query DB prod (Supabase MCP sesi ini ke akun lain) — jadi beberapa temuan butuh verifikasi runtime.

## Hasil ringkas

- **0 Critical**, **0 High** yang bertahan setelah verifikasi (4 kandidat awal semua di-*downgrade*). Ini sinyal bagus: RLS di-iterasi rapi, secret tidak ke-track, tidak ditemukan SQL/NoSQL injection, SSRF, RCE, path traversal, atau XSS.
- **~7 Medium**, **~9 Low** (setelah dedup). Mayoritas: (a) risiko yang bergantung status migrasi/env di prod, (b) integritas data (race/atomicity), (c) hardening & cost-abuse.
- **Blocker komersial utama**: checkout/pembayaran masih placeholder (pricing display-only, belum ada gateway + webhook).

## Skor

| Dimensi | Skor | Catatan |
|---|---|---|
| Security | 80/100 | Tak ada lubang kritikal; sisa gap bergantung verifikasi migrasi prod (026/052/055/057) + SERVICE_ROLE_KEY. 2FA-on-API baru ditutup. |
| Architecture | 78/100 | Bersih, token semantik, komponen ter-ekstrak. Ada pola read-modify-write saldo & 2-write tanpa transaksi. |
| Maintainability | 82/100 | TS strict, 245 unit test, migrasi ter-dokumentasi, i18n. Test nol di jalur uang. |
| Performance | 78/100 | Tak ada bencana; belum di-benchmark formal. N+1 kecil di cron. |
| Reliability | 72/100 | Rate-limit + circuit-breaker in-memory (per-instance). Cron dedup lemah. Retry/breaker ada. |
| UX | 80/100 | Redesign mobile aktif (baris-compact ala Stockbit); masih iterasi. |
| Production Readiness | 78/100 | RLS + consent + security_events + export/delete (UU PDP) + Sentry + PWA. Butuh verifikasi migrasi prod + test jalur uang. |
| Commercial Readiness | 55/100 | Checkout/webhook billing belum ada → monetisasi de-facto manual. |

## Verdikt

1. **Layak produksi?** Ya, dengan syarat: verifikasi migrasi 026/052/055/**057** ter-apply di prod + `SUPABASE_SERVICE_ROLE_KEY` ter-set di Vercel. Secara fungsional solid.
2. **Layak dikomersialkan (auto-paid)?** Belum. Pricing page display-only, tak ada gateway/webhook yang menulis `subscriptions.status/expires_at`. Monetisasi masih manual.
3. **3 penghambat terbesar:** (a) billing belum ter-wire (komersial); (b) verifikasi migrasi/env prod (self-refill kredit + subscriptions write); (c) nol test di jalur revenue (kredit/refund/cron).

---

## Temuan (setelah verifikasi)

### Medium

1. **subscriptions dual-use / RLS write** — `supabase/migrations/036_subscriptions.sql`. Tabel billing (014) sempat dapat policy write dari fitur tracker yang di-abandon → user bisa self-grant paket + naikin cap kredit dari console. 052 sudah menutup. **Aksi: verifikasi prod** `select policyname,cmd from pg_policies where tablename='subscriptions'` harus SELECT-only. Migration **057** (baru) me-re-assert + revoke, idempoten. → *ditutup di repo, tinggal apply*.
2. **price_history writable by any authenticated** — `009_price_history.sql:43-52` `with check(true)` → cache poisoning harga. 055 lewatin ini. Migration **057** menutupnya. Saat ini dormant (tak ada kode yg baca/tulis). → *ditutup di repo, tinggal apply*.
3. **Balance read-modify-write race** — `quick-add-launcher.tsx`, `transactions/page.tsx`, `credit-cards/page.tsx`. `current_balance = <state-client-basi> + amount` → lost update. Kartu kredit RLS owner-only (aman multi-user), tapi `accounts` punya RLS household → dua anggota bisa lost-update saldo. **Aksi: RPC increment atomik** (butuh migrasi + swap kode; deploy-ordering). → *belum, butuh migrasi dulu*.
4. **2FA cuma di dashboard layout, bukan API** — `dashboard/layout.tsx`. Sesi AAL1 bisa hit `/api/export-data` & `/api/delete-account`. → **DITUTUP**: helper `needsStepUp()` + gate di kedua route.
5. **AI credit double-charge konkuren** — `idx-research/[ticker]/generate/route.ts`. Cek-cache → charge tanpa lock → double-click charge 2×30 kredit. **Aksi: klaim idempoten (insert on conflict) + limiter terdistribusi.** → *belum*.
6. **parse-transaction: AI gratis tanpa credit-ceiling** — throttle cuma rate-limit in-memory per-instance → biaya Anthropic bisa liar. Keputusan produk (retensi). **Aksi: charge nl_parse=1 ATAU limiter terdistribusi.** → *keputusan produk*.
7. **Nol test di jalur revenue** — ai-credits, consume/refund, cron reminders/snapshots. Refactor kecil bisa diam-diam bikin double-charge/refund-gagal tanpa CI merah. **Aksi: unit test (mock Supabase).** → *belum*.

### Low (ditutup / dijadwalkan)

- **RPC error message leak** → **DITUTUP** (pesan generik + log server).
- **CSS-injection block IDs (self-scoped)** → **DITUTUP** (whitelist `[a-z0-9_-]`).
- **quick-add 2-write tanpa kompensasi** (saldo kartu gagal senyap) → **DITUTUP** (toast.warning).
- **household invite tanpa throttle** (email bombing) → **DITUTUP** (rateLimit 5/jam).
- **shadcn di dependencies narik hono rentan** → **DITUTUP** (pindah ke devDependencies).
- **self-refill kredit** (bergantung migrasi 026 + SERVICE_ROLE_KEY) → *verifikasi prod*.
- **accept_household_invitation TOCTOU** (kapasitas seat) → *migrasi: SELECT FOR UPDATE*.
- **refund clamp ke cap** (edge, kredit bisa hilang) → *ledger-based refund*.
- **cron reminders N+1 + dedup lemah** → *batch fetch + guard idempoten*.
- **rate-limit/breaker in-memory** → *pindah Upstash Redis saat scale*.
- **billing checkout placeholder** → *implement gateway + webhook (HMAC + idempotency)*.

---

## Roadmap remediasi

**Sprint 1 — verifikasi prod → ✅ SELESAI & TERVERIFIKASI (2026-07-02):**
- ✅ Migrasi **057** ter-apply ("Success, no rows returned").
- ✅ `subscriptions` grant untuk `authenticated`/`anon` = SELECT saja (tanpa INSERT/UPDATE/DELETE) → revenue-bypass tertutup.
- ✅ `price_history` grant = SELECT saja → cache-poisoning tertutup.
- ✅ `has_function_privilege('authenticated', ...)` untuk refund/consume/reset kredit = **false** semua (026 ter-apply) → self-refill tertutup.
- ✅ `SUPABASE_SERVICE_ROLE_KEY` ter-set di Vercel (Production + Preview); `CRON_SECRET` ter-set; tidak ada secret ber-prefix `NEXT_PUBLIC_`.

  → Semua temuan keamanan yang bergantung status prod: **CLOSED**. Security posture efektif naik (~80 → ~88).

**Sprint 2 — integritas data → ✅ SELESAI (2026-07-02):**
- ✅ RPC `adjust_account_balance`/`adjust_credit_card_balance` (migrasi 059, ownership-safe) + `src/lib/data/balances.ts` (fallback-compat) → 8 situs write saldo di-swap. Race lost-update ditutup.
- ✅ Idempoten `idx-research/generate` (migrasi 060 claim table + finally-release) → double-charge dicegah.

**Sprint 3 — test + reliability → ✅ SELESAI (2026-07-02):**
- ✅ Unit test jalur uang (`ai-credits.test.ts` + `reminders.test.ts`, 256 test) + extract `reminders.ts` pure.
- ✅ Cron idempoten via migrasi 061 `reminder_log` (PK user+threshold+tanggal) → anti email dobel.
- ✅ `/api/health` (uptime monitor). ✅ delete-account tutup tabel orphan (xp_events/achievements).
- ✅ Shared AI client `src/lib/ai/client.ts` (dedup 6 route). — Limiter terdistribusi (Upstash) = post-launch.

**Sprint 4 — komersial + scale (POST-LAUNCH, di-defer):**
- ✅ Payment scaffold Xendit GATED (checkout+webhook+activation) — nunggu NIB (lihat `BILLING_XENDIT_READINESS.md`).
- ⏳ **#122 (satu-satunya sisa audit, POST-LAUNCH):** SSE streaming AI + server-pagination transaksi + i18n landing/auth. **Sengaja belum dikerjain** — semuanya perf/skala/i18n yang (a) nol benefit di pra-launch ~0 user, (b) pagination = refactor berisiko di god-file transactions 1800-baris, (c) SSE ke research route berisiko nyenggol logika kredit/klaim/cache yang baru di-harden (bisa re-introduce double-charge). Kerjain per-item di sesi fokus **pas mulai scale / targetin pasar EN**, bukan sekarang.
- ⏳ accept_invitation `FOR UPDATE`; refund berbasis ledger (low, post-launch).

## 10 improvement ROI tertinggi

1. Apply migrasi 057 + verifikasi 052/055 (tutup revenue-bypass + cache-poison) — trivial.
2. Verifikasi 026 + SERVICE_ROLE_KEY (tutup self-refill / cegah AI hard-fail) — trivial.
3. RPC increment saldo atomik (integritas finansial inti) — medium.
4. Idempoten generate research (stop double-charge kredit) — medium.
5. Unit test jalur kredit/refund (cegah regresi mahal) — medium.
6. Guard idempoten cron reminder (stop email dobel) — small.
7. Wire billing (buka revenue otomatis) — large, tapi ROI komersial tertinggi.
8. Limiter terdistribusi endpoint AI (rem biaya Anthropic saat scale) — medium.
9. accept_invitation FOR UPDATE (tegakkan batas seat berbayar) — small.
10. Selesaikan redesign mobile + baris-compact (retensi/UX konversi) — sedang berjalan.

---
*Fix Sprint-1/2 low-risk sudah dieksekusi & di-push (commit 6cc151e). Sisanya butuh verifikasi prod / keputusan / urutan-deploy.*
