# Kesiapan Payment Gateway — Xendit (gated OFF)

Status: **scaffold siap, MATI total**. Menunggu NIB keluar. Selama `BILLING_ENABLED` bukan `'true'`, tidak ada perubahan perilaku app — checkout & webhook balikin 503.

## Apa yang sudah ada di repo

| File | Fungsi |
|---|---|
| `supabase/migrations/058_billing_events.sql` | Ledger idempotensi (anti double-process webhook). Service-role only. |
| `src/lib/billing/config.ts` | Gerbang `billingEnabled()` + `PAID_PLAN_IDS` + `PLAN_PRICES` (harga server-side, jangan percaya client). |
| `src/lib/billing/xendit.ts` | `verifyXenditCallback()` (cek `x-callback-token`, constant-time), `createXenditInvoice()`, `activateSubscription()` (satu jalur tulis subscription, service-role). |
| `src/app/api/billing/checkout/route.ts` | Bikin invoice → balikin payment URL. Auth + rate-limit + validasi plan. Gated. |
| `src/app/api/billing/webhook/route.ts` | Terima callback Xendit: verifikasi token → idempoten → aktifkan subscription + email. Gated. |

**Alur:** user tekan Upgrade → `POST /api/billing/checkout` → invoice Xendit → user bayar → Xendit callback `POST /api/billing/webhook` → subscription jadi `active` + email sukses. `plan_id`/`user_id` ditanam di metadata invoice (bukan ditebak → tidak ada IDOR). Harga dari `PLAN_PRICES` server-side.

## Langkah go-live (pas NIB keluar) — ~15 menit, TANPA ngoding lagi

1. **Xendit**: daftar (butuh NIB), ambil **Secret Key**, set **Callback URL** = `https://klunting.com/api/billing/webhook`, salin **Callback Verification Token**.
2. **Env di Vercel (Production + Preview)**:
   - `XENDIT_SECRET_KEY=...`
   - `XENDIT_CALLBACK_TOKEN=...`
   - `BILLING_ENABLED=true`
   - (pastikan `SUPABASE_SERVICE_ROLE_KEY` sudah ada — ✅ sudah)
3. **DB**: apply `supabase/migrations/058_billing_events.sql` di Supabase SQL Editor.
4. **Wire tombol Upgrade** di `src/app/dashboard/pricing/page.tsx`: ganti `handleUpgrade` dari `alert(...)` jadi:
   ```ts
   const res = await fetch('/api/billing/checkout', {
     method: 'POST', headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ planId, period: billing }),
   })
   const j = await res.json()
   if (j.url) window.location.href = j.url
   else toast.error(j.error ?? 'Gagal')
   ```
   ⚠️ Petakan id UI ke id DB: kartu **"Max"** di UI = `plan_id` **`family`** di DB (`pro` → `pro`). Kirim id DB ke checkout.
5. **Test di Preview dulu** (mode test Xendit): bikin invoice test → bayar → cek subscription jadi `active` + email sukses masuk. Baru flip di Production.

## Catatan aman
- Semua fungsi Xendit throw/503 kalau env belum ada → aman walau ke-deploy sekarang.
- Webhook idempoten via `billing_events.id = xendit:<invoice>:<status>` → retry gateway tidak dobel.
- Subscription cuma bisa ditulis service-role (RLS user = SELECT-only, dikunci migrasi 052/057) → user tidak bisa self-activate.
- Top-up kredit Aku (credit packs) belum di-scaffold — pola sama, tinggal tambah `plan`/produk + handler di webhook kalau mau nanti.
