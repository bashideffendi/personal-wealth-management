# Instruksi Lanjutan: Redesain Screener v2 (Kebebasan Desain)

Kerjakan di branch `feat/screener-v2`. Tetap tidak merge ke `master`, tidak deploy produksi, dan tidak menyentuh Supabase. Hemat token.

## Penilaian Pemilik atas Versi Sekarang

"Tak beda jauh dengan sebelumnya secara desain." Pemilik membebaskan desainnya, asalkan hasilnya terasa **premium, rapi, minimal, dan jelas bukan AI slop**. Data, API, lib (`src/lib/invest/screener.ts`) dan tesnya sudah benar dan dipertahankan. Yang dirombak adalah **tampilan dan interaksi halaman**.

Masalah yang terlihat di screenshot pemilik:

- **Filter memakan 3 baris dan terasa berat.** Chip preset hitam penuh terlihat seperti tombol besar. Semua preset bisa aktif sekaligus dan ditumpuk diam-diam (AND), sampai hasilnya tinggal 2 emiten tanpa penjelasan.
- **Chip sektor** berderet panjang dan mendominasi halaman.
- **Tabel** tidak punya hierarki visual, dan halaman menyisakan banyak ruang kosong. Skor hanya berupa garis tipis dan angka, sehingga tidak ada yang "dibaca dulu".

## Kebebasan dan Arah

Kamu bebas memilih layout dan pola interaksi terbaik. Beberapa arah yang layak dipertimbangkan, tidak wajib:

- **Kiblat kepadatan dan presisi:** daftar isu Linear, screener Koyfin, Copilot Money. Rasanya seperti alat kerja yang serius dan tenang.
- **Filter ringkas:**
  - satu bilah dengan pencarian, pemilih set kolom, satu menu preset (pilih satu, dengan jumlah hasil per preset), dan menu sektor (dropdown multi-pilih, bukan deretan chip);
  - filter aktif tampil sebagai token kecil yang bisa dihapus satu per satu, dengan keterangan "N dari 967";
  - alternatif: rel filter kiri yang bisa dilipat.
- **Hierarki di tabel:**
  - ticker tebal dan nama redup;
  - skor gabungan sebagai fokus baca (angka dua digit + meter halus), kolom lain sekunder;
  - warna hanya muncul di data yang bermakna.
- **Ringkasan di atas tabel** dalam satu baris tipografis, bukan kartu, misalnya "161 berskor · median skor sektor · 12 bank". Opsional.
- **Panel samping** yang terasa premium: tipografi angka besar tabular untuk skor, batang rentang nilai wajar yang bersih, dan penanda risiko berupa daftar tenang.
- **Mobile:** daftar baris ringkas (ticker, nama, skor, harga), filter di sheet bawah.

## Pagar (Tetap Wajib)

- **Token Klunting:** `src/app/globals.css`, font Geist, angka tabular, garis rambut 1px, satu skala radius.
- **Warna hanya di data:** teal positif / persentil tinggi, coral negatif. Teks memakai `--c-mint-ink` / `--c-coral-ink`. Kontrol mono.
- **DILARANG:**
  - serif atau italic dekoratif;
  - kartu dengan garis warna di atas;
  - grid kartu berikon;
  - gradien, glass, emoji;
  - badge warna-warni;
  - angka "potensi naik" yang dibesarkan;
  - spanduk peringatan besar;
  - chip hitam penuh berderet.
- **Disclaimer satu baris dan tanggal data tetap ada** dan diambil dari meta. Kelas model tetap hanya di panel samping, berlabel "kelas model riset, belum tervalidasi".
- **Aksesibilitas:** `<button>`/`<a>` asli, kontras teks ≥ 4.5:1, border kontrol ≥ 3:1, target sentuh ≥ 44px di HP.
- **Tes dan build harus lulus.** Kalau preset berubah menjadi pilih-satu, sesuaikan lib dan tesnya.

## Selesai Berarti

Commit dan push ke `feat/screener-v2`. Tambahkan di `docs/SCREENER_V2_PLAN.md` bagian "Status build" berisi dua atau tiga kalimat tentang apa yang berubah secara desain dan alasannya. Pemilik menilai lewat preview Vercel.
