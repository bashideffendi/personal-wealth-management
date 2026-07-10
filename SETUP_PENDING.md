# Setup Pending — Klunting (mode otonom 2026-07-07)

Semua kode di branch `redesign/mobile` sudah graceful: app TETAP jalan walau
langkah di bawah belum dikerjakan (fitur terkait sekadar belum aktif). Kerjakan
kapan saja.

## 1. Migrasi SQL Supabase (SQL Editor dashboard project Klunting)

Jalankan berurutan. Semua additive + idempoten (`if not exists`), aman diulang.

### 062 — auto-post recurring ✅ SUDAH DIPASANG USER
```sql
alter table public.recurring_transactions add column if not exists last_posted_date date;
alter table public.recurring_transactions add column if not exists auto_post boolean not null default false;
```

### 063 — push notification (file: supabase/migrations/063_push_subscriptions.sql)
Jalankan isi file itu (tabel `push_subscriptions` + RLS own-only + index).
Setelah ini: toggle "Notifikasi" di Lainnya + reminder H-1/harian aktif.

### 064 — split transaction (file: supabase/migrations/064_transaction_split.sql)
Jalankan isi file itu (kolom `split_group_id` + index parsial).
Setelah ini: fitur "Bagi ke beberapa kategori" ter-grup rapi.

## 2. Environment Variables Vercel (Settings → Environment Variables, scope Production+Preview)

Push notification butuh VAPID (kalau belum aktif, push cuma no-op — aman).
**Repo ini PUBLIK — nilai key TIDAK ditulis di sini.** Ambil dari file
`.env.local` (gitignored, di root project, sudah berisi ketiganya):
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY   (public key — aman disebar; boleh dari .env.local)
VAPID_PRIVATE_KEY              (RAHASIA — copy dari .env.local, jangan sebar)
VAPID_SUBJECT=mailto:bashide@gmail.com
```
Buka `.env.local` → copy tiga baris VAPID → tempel ke Vercel env
(Production+Preview). Pastikan juga `CRON_SECRET` sudah ada (dipakai semua cron).

> Kalau VAPID_PRIVATE_KEY pernah bocor (mis. ter-commit), ROTATE:
> `npx web-push generate-vapid-keys` → update Vercel + .env.local.

## 3. Opsional — bersih-bersih skema (kapan sempat)
- `drop table if exists public.xp_achievements;` — fitur gamifikasi tak pernah
  dibangun, nol referensi di kode (audit fitur 2026-07-07).
