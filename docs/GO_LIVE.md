# Go-Live Checklist — merge `redesign/mobile` → master

**Status: master tidak bergerak · nol konflik ke master · migrasi 057-061 sudah
di-apply di prod. VERIFY BUILD+TEST DI TIP TERKINI SEBELUM MERGE** (jumlah commit
+ test terus nambah dari beberapa sesi paralel — jangan percaya angka statis).

⚠️ **PENTING — branch ini gabungan BANYAK sesi:** selain hardening/backend/Xendit,
branch `redesign/mobile` mencakup **REDESIGN MOBILE TOTAL "ala app Budget" (F8-F13,
mockup approved)** + fitur besar (web push PWA, offline queue quick-entry, split
transaction, auto-post recurring, katalog bank, billing dibekukan, Keluarga
disimpel, cron snapshot net worth, ⌘K cari transaksi, audit desktop + a11y +
i18n date). **Go-live harus di-drive sesi yang punya KONTEKS redesign itu** (bukan
sesi backend/audit) supaya bisa mastiin semua yang di tip sekarang emang layak
tayang. Backend/keamanan/Xendit(gated-off) dari sesi ini = aman & sudah kegabung.

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
