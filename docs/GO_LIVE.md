# Go-Live Checklist — merge `redesign/mobile` → master

**Status (2026-07-02): MERGE-READY.** 34 commit ahead of master · master tidak
bergerak · **nol konflik** · `npm run build` + `npm test` (256) hijau · migrasi
057-061 sudah di-apply di Supabase prod.

Branch `redesign/mobile` = SEMUA kerjaan yang belum live: redesign mobile penuh
(chrome + density baris-compact + rebrand 4-warna + logo center) · tema Bersih
default + Cartoon opsi · hardening (2FA API, error generik, rate-limit invite,
CSS-injection guard, shadcn→dev) · saldo atomik (RPC) · idempotensi generate
research · /api/health · test jalur uang · shared AI client · cron idempoten +
delete-account orphan · **scaffold Xendit (GATED OFF — gak aktif sampai
BILLING_ENABLED=true)**.

## SEBELUM merge (wajib)
1. Buka **PREVIEW** (BUKAN klunting.com) di HP:
   `https://personal-wealth-management-git-redesign-mobile-bashideffendi.vercel.app`
   (incognito / hard-refresh). Cek redesign mobile kerasa bener + coba tema
   Bersih/Cartoon di Profil.

## Merge (pilih salah satu) → auto-deploy production klunting.com
- **GitHub**: buka PR `redesign/mobile` → `main/master`, klik Merge.
- **CLI**:
  ```
  cd "D:\Claude-Projects\2. Finance and Investment\Klunting"
  git checkout master && git pull && git merge redesign/mobile && git push origin master
  ```
- **Via Claude**: bilang "go merge" di sesi mana pun (aku verify hijau dulu, lalu merge).

## SESUDAH merge
- Vercel auto-build → cek deploy READY + buka klunting.com (hard-refresh / clear
  PWA cache — shell lama bisa nyangkut).
- Migrasi: TIDAK ada langkah tambahan (057-061 sudah live di DB).
- Billing tetap OFF (aman). Aktivasi Xendit = terpisah, pas NIB keluar
  (lihat `BILLING_XENDIT_READINESS.md`).

## Rollback (kalau perlu)
Vercel → project → Deployments → cari deploy production sebelum merge → "Promote
to Production". DB gak perlu di-rollback (migrasi additive/backward-compatible).

## Sisa (post-launch, gak blokir go-live)
#122: SSE streaming AI + pagination transaksi + i18n landing (lihat
`AUDIT_COMMERCIAL_READINESS.md`).
