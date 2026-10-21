# Instruksi Sesi Cloud: Audit Ulang Ringan Klunting (Okt 2026)

Kerjakan di branch `audit/2026-10`. Jangan merge ke `master`, jangan deploy produksi, dan jangan terapkan migrasi ke Supabase (berkas SQL baru boleh ditulis, tandai "BELUM DITERAPKAN"). Bekerja hemat token: ini audit ringan, bukan audit total.

## Konteks

Audit total terakhir dilakukan 10 Jul 2026 (76 temuan, roadmap P0–P4), lalu redesign desktop di-merge 11 Jul. `master` tidak berubah sejak 11 Jul. Ringkasan temuan Juli yang perlu dicek statusnya:

- **Uang/data:**
  1. import mutasi ke kartu kredit tanpa `adjustCardBalance` (kemungkinan sudah diperbaiki);
  2. net worth dihitung di 6 tempat;
  3. income di Goals tanpa exclude Transfer dan pembagi /3 tetap;
  4. insights menghitung kaki Transfer dua sisi;
  5. semantik saldo asimetris: bayar kartu kredit memotong rekening, bayar utang dan transfer tidak;
  6. race pada `debts.remaining` (RPC 059);
  7. supabase client bertipe `(): any`.
- **Performa:**
  1. recharts terduplikasi di banyak chunk;
  2. `messages.ts` besar dimuat di semua halaman;
  3. landing gagal prerender dan bundle marketing besar;
  4. `transactions select('*')` tanpa batas, dengan risiko cap 1000 baris PostgREST;
  5. dashboard menembak banyak request;
  6. spinner halaman penuh di tiap mutasi;
  7. middleware memanggil `getUser` sebelum cek rute publik.
- **Desain/aksesibilitas:**
  1. border input dengan kontras 1,17:1 (gagal WCAG 1.4.11);
  2. ±990 ukuran teks ad-hoc;
  3. radius dan shadow tidak seragam;
  4. tidak ada `loading.tsx`;
  5. error di halaman budgeting menampilkan grid nol palsu.
- **Keamanan, cek ulang:**
  1. RLS di semua tabel, termasuk tabel baru sejak Juli;
  2. tidak ada secret atau service-role di kode atau klien;
  3. Sentry tetap privasi-aman (`sendDefaultPii=false`, replay mati, `beforeSend` membersihkan data);
  4. CSP;
  5. `npm audit` (jangan `audit fix --force`).

## Tugas

1. Untuk setiap butir di atas, cek kode sekarang dan beri status **sudah / sebagian / belum**, dengan rujukan `berkas:baris`.
2. Pindai cepat bug baru yang jelas, terutama hal yang memengaruhi angka uang, keamanan atau data pengguna.
3. Tulis `docs/AUDIT_2026_10.md`: tabel status, temuan baru dengan prioritas P0–P3, dan rekomendasi urutan perbaikan.
4. **Perbaiki hanya P0** (salah angka uang, kebocoran data atau keamanan) dengan commit kecil + tes, sambil menjaga kontrak angka di `src/lib/data/cashflow-forecast.ts` dan `balances.ts`. Sisanya cukup dilaporkan.
5. `npm run build` + tes lulus, lalu push.

## Selesai Berarti

Laporan ter-push, perbaikan P0 (kalau ada) ter-push dan lulus build/tes, dan ringkasan 10 baris di akhir laporan untuk pemilik.
