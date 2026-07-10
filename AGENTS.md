<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Semantik saldo (KEPUTUSAN — jangan tambah varian baru)

Saldo akun (`accounts.current_balance`) = **DIKELOLA MANUAL oleh user** (lihat
`src/lib/liquid.ts`). Insert/edit/delete transaksi TIDAK meng-update saldo akun,
di jalur mana pun (form, quick-add, command-palette, import, recurring, offline).

Pengecualian yang DIIZINKAN — hanya dua, dua-duanya lewat `src/lib/data/balances.ts`
(RPC atomik + fallback):

1. **Outstanding kartu kredit** (`credit_cards.current_balance`): expense yang
   menarget kartu MENAIKKAN outstanding, di SEMUA jalur (form transaksi, quick-add,
   import mutasi, edit/hapus/bulk = reverse). Kartu = meteran utang, bukan rekening kas.
2. **Bayar kartu kredit** (`credit-cards/page.tsx`): mengurangi rekening sumber via
   `adjustAccountBalance`, sengaja TANPA membuat transaksi.

Sisa utang (`debts.remaining`) hanya ditulis via `adjustDebtRemaining` (RPC 065).
Bayar utang TIDAK menyentuh rekening sumber (form-nya tidak punya field rekening) —
kalau mau ledger-driven penuh, itu keputusan produk terpisah, jangan diselipkan.

Jalur tulis saldo baru WAJIB lewat `lib/data/balances.ts`, bukan `.update()` langsung.
