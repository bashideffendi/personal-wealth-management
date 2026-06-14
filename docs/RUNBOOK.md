# Klunting — Ops Runbook

Operasional produksi untuk **klunting.com**. Ditujukan buat operator solo (founder).
Update tiap kali infra/secret/cron berubah. (reliability-2)

- **Produk:** Klunting (folder repo: `personal-wealth-management`)
- **Hosting fungsi:** Vercel, region **`sin1`** (Singapura — dekat DB Supabase)
- **Database/Auth:** Supabase Postgres (RLS di semua tabel + RPC SECURITY DEFINER)
- **Repo:** `github.com/bashideffendi/personal-wealth-management` (push ke `master` = auto-deploy Vercel)

---

## 1. Environment variables

| Variabel | Sifat | Di-set di | Fungsi |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | publik | Vercel + `.env.local` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publik | Vercel + `.env.local` | Anon key (RLS-gated) |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRET** | Vercel (Prod+Preview) + `.env.local` | Bypass RLS — metering kredit AI (consume/refund/reset), cron scan semua user. **JANGAN** prefix `NEXT_PUBLIC_`. |
| `ANTHROPIC_API_KEY` | **SECRET** | Vercel + `.env.local` | Claude (OCR struk, insight, playbook, research) |
| `RESEND_API_KEY` | **SECRET** | Vercel + `.env.local` | Email transaksional (welcome, reminder) |
| `CRON_SECRET` | **SECRET** | Vercel | Auth header cron (`Authorization: Bearer $CRON_SECRET`) |
| `NEXT_PUBLIC_SITE_URL` | publik | Vercel | Origin buat link email/redirect (default `https://klunting.com`) |
| `AI_ACCESS_PASSWORD` | **SECRET** | Vercel | Gate fitur AI (kalau dipakai) |
| `SENTRY_AUTH_TOKEN` | **SECRET** (opsional) | Vercel | Source-map prod kebaca (scope `project:releases`+`org:read`) |
| `NEXT_PUBLIC_SENTRY_DSN` | publik (opsional) | Vercel | DSN Sentry (ada fallback hardcoded) |
| `NEXT_PUBLIC_DEMO_MODE` | publik | — | **HARUS tidak `'true'` di prod.** Demo mode fail-CLOSED + dev-only (`&& VERCEL_ENV!=='production'`). |

> Peta key Anthropic & runbook rotasi lintas-project ada di memory `reference_anthropic_api_keys`.

---

## 2. Deploy

- **Produksi:** `git push origin master` → Vercel build + deploy otomatis (region sin1, ~3–4 min).
- **Preview:** buka PR ke `master` → Vercel bikin preview URL. Cron **tidak** jalan di preview (env-gated ke production).
- **Cek build:** Vercel dashboard → Deployments → status `Ready`. CI GitHub Actions (lint + test:coverage + build) jalan paralel sebagai gate sinyal.

## 3. Rollback (1-klik)

1. Vercel dashboard → project → **Deployments**.
2. Pilih deployment stabil sebelumnya → **⋯ → Promote to Production** (instan, gak rebuild).
3. Alternatif kode: `git revert <sha> && git push` (bikin commit balik, aman daripada force-push).

> Catatan: rollback Vercel **tidak** membalik migrasi DB. Kalau rilis terakhir ada migrasi yang merusak, balikin DB-nya manual (lihat §5/§6).

---

## 4. Migrasi database

Klunting pakai SQL migration bernomor di `supabase/migrations/NNN_nama.sql`.

**Aturan:**
- Tulis migrasi **idempoten** (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, dll) — boleh dijalankan ulang tanpa rusak.
- Bungkus migrasi multi-statement dalam **`BEGIN; … COMMIT;`** biar atomik (gagal di tengah = rollback).
- Penomoran berurutan (terakhir: `054`). Jangan reuse nomor.

**Cara apply (manual, sampai Supabase CLI di-adopsi):**
1. Supabase dashboard → **SQL Editor**.
2. Paste isi file migrasi → **Run**.
3. Verifikasi "Success. No rows returned" (atau hasil yang diharapkan).
4. Catat di changelog Notion bahwa migrasi sudah di-apply.

**Migrasi nganggur diketahui:** `050_xp_achievements.sql` (tabel `xp_events`/`achievements`) — fitur XP dicabut, tabel duduk diam (harmless). Drop-nya butuh migrasi baru.

---

## 5. Backup & restore (Supabase)

> ⚠️ **Saat ini Free tier — belum ada backup harian / PITR.** Upgrade ke **Pro + aktifkan PITR (window 7 hari)** = blocker komersial (lindungi data finansial). Sampai itu, data loss = permanen.

Setelah Pro aktif:
1. Dashboard → **Database → Backups** (daily) / **Point-in-Time Recovery**.
2. **Restore drill (wajib dites sekali):** restore backup ke project sandbox → verifikasi data utuh → dokumentasikan langkah di sini.
3. Restore prod: dashboard → pilih timestamp PITR → restore. Umumkan downtime dulu.

---

## 6. Rotasi secret

Urutan aman (bikin baru → update host → verify → baru revoke yang lama):
1. Generate key baru di provider (Anthropic/Resend/Supabase).
2. Update di **Vercel env** (Prod + Preview) + **`.env.local`** lokal.
3. **Redeploy** (env baru kebaca saat build/runtime berikutnya).
4. Verifikasi fitur jalan (kirim 1 request AI/email; cek dashboard provider key "last used").
5. Baru **revoke** key lama.

- `CRON_SECRET`: ganti → update Vercel → redeploy (Vercel auto-inject ke cron header).
- `SUPABASE_SERVICE_ROLE_KEY`: rotasi di Supabase dashboard → Settings → API → roll. Hati-hati: metering kredit + cron bergantung ke ini.

---

## 7. Cron jobs

Dijadwalkan di `vercel.json`:

| Path | Jadwal (UTC) | WIB | Fungsi |
|---|---|---|---|
| `/api/cron/portfolio-snapshots` | `0 10 * * *` | 17:00 | Snapshot nilai portfolio per user (harga di-refresh server-side). Idempoten (`upsert onConflict user_id,snapshot_date`). |
| `/api/cron/reminders` | `0 2 * * *` | 09:00 | Email trial-ending + renewal H-14/3/0 (auto-renew OFF). Dedup exact-date. |

- **Auth:** Vercel kirim `Authorization: Bearer $CRON_SECRET`. Tanpa secret yang cocok → 401.
- **Env-gate:** keduanya skip kalau `VERCEL_ENV` di-set & ≠ `production` (preview gak nulis ke data prod). Lokal (`VERCEL_ENV` unset) tetap jalan buat testing.
- **Butuh:** `SUPABASE_SERVICE_ROLE_KEY` (scan semua user) + `RESEND_API_KEY` (reminders; absen → email no-op, run cuma log).
- **Triage cron gagal:** Vercel dashboard → cron logs / function logs. Cek: secret cocok? service-role key ada? Upstream (Yahoo/Binance) down? Re-run aman (idempoten).

---

## 8. Incident response

| Gejala | Diagnosa & langkah |
|---|---|
| **App 500 menyeluruh** | Cek Vercel function logs. Auth Supabase down? Middleware sudah **fail-open** (rute publik tetap render). Kalau build terakhir penyebabnya → rollback (§3). |
| **Login gagal semua** | Cek Supabase Auth status + `NEXT_PUBLIC_SUPABASE_*` env. OAuth Google? cek provider config. |
| **Lonjakan biaya AI** | Cek Anthropic dashboard usage. Kredit AI di-meter server-side (consume/refund). Rate-limit + cap per-rute (FASE 1). Kalau abuse → revoke key sementara (§6) / matikan rute. |
| **Email gak terkirim** | Resend dashboard → Logs. Cek `RESEND_API_KEY` + domain `klunting.com` verified. |
| **Data salah/hilang** | JANGAN panik-write. Cek apakah migrasi terakhir penyebab. Restore PITR (§5, setelah Pro). |
| **Cron gak jalan** | §7 triage. |

---

## 9. CI / monitoring

- **CI:** `.github/workflows/ci.yml` — `npm ci` (Node 22 via `.nvmrc`) → `npm run lint` → `npm run test:coverage` (coverage floor money-math) → `npm run build`. Gate di push/PR ke `master`.
- **Error monitoring:** Sentry wired privacy-safe (`sentry.*.config.ts`, Session Replay OFF, PII scrubbed). Set `SENTRY_AUTH_TOKEN` biar stack-trace prod kebaca.
- **Uptime monitor:** _TODO_ (BetterStack/UptimeRobot + endpoint `/api/health`) — belum ada.

---

_Terakhir diperbarui: 14 Jun 2026. Tambahkan entri tiap infra/secret/cron berubah._
