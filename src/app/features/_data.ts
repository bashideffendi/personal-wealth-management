import {
  LineChart, TrendingUp, Wallet, Sparkles, CreditCard, Users, Shield,
  type LucideIcon,
} from 'lucide-react'

export type FeatureSection = { title: string; body: string }

export type Feature = {
  slug: string
  name: string
  /** one-line value prop, used on the grid card + as the detail subtitle */
  tagline: string
  icon: LucideIcon
  /** hero screenshot path (webp) — null = copy-led page (no shot yet) */
  shot: string | null
  shotAlt?: string
  intro: string
  sections: FeatureSection[]
  faq: { q: string; a: string }[]
}

export const FEATURES: Feature[] = [
  {
    slug: 'net-worth',
    name: 'Net worth & seluruh akun',
    tagline: 'Semua aset dikurangi semua utang, jadi satu angka yang diperbarui tiap hari.',
    icon: LineChart,
    shot: '/features/networth.webp',
    shotAlt: 'Kartu net worth Klunting dengan total aset, total utang, dan grafik pertumbuhan',
    intro:
      'Keuangan tersebar di banyak tempat membuat satu pertanyaan sederhana jadi sulit dijawab: sebenarnya, seperti apa posisi keuanganku? Klunting menyatukannya jadi satu angka net worth yang jelas.',
    sections: [
      { title: 'Semua akun di satu tempat', body: 'Rekening bank, kas, e-wallet, kartu kredit, hingga rekening dana nasabah (RDN). Tambahkan saldo manual atau impor mutasi — tidak perlu menyambungkan password m-banking.' },
      { title: 'Satu angka net worth', body: 'Total aset dikurangi total utang, lengkap dengan riwayat dan grafik pertumbuhan bulan ke bulan. Lihat apakah kondisimu membaik, bukan sekadar saldo hari ini.' },
      { title: 'Komposisi & aset non-likuid', body: 'Kas, investasi, properti, dan kendaraan dalam satu pandangan. Aset non-likuid bisa dicatat dengan penyusutan otomatis sehingga nilainya tetap realistis.' },
      { title: 'Proyeksi ke depan', body: 'Lihat proyeksi net worth dan estimasi tanggal bebas utang berdasarkan arus kas dan strategi pelunasanmu.' },
    ],
    faq: [
      { q: 'Apakah aku perlu menyambungkan rekening bank?', a: 'Tidak. Klunting tidak terhubung langsung ke bank. Kamu memasukkan saldo manual atau mengunggah mutasi (CSV/PDF) — tidak ada password m-banking yang disimpan.' },
      { q: 'Bisa untuk aset properti dan kendaraan?', a: 'Bisa. Aset non-likuid punya input tersendiri dengan opsi penyusutan otomatis, jadi nilainya ikut diperhitungkan dalam net worth.' },
    ],
  },
  {
    slug: 'investasi',
    name: 'Investasi & riset saham IDX',
    tagline: 'Bukan cuma mencatat portofolio — riset fundamental 1.000+ emiten IDX di dalam aplikasi.',
    icon: TrendingUp,
    shot: '/features/research.webp',
    shotAlt: 'Halaman riset saham Klunting untuk BBCA: fair value, konsensus valuasi, dan rasio kunci',
    intro:
      'Inilah yang membedakan Klunting dari aplikasi pencatatan biasa. Pantau portofolio multi-aset sekaligus dapatkan riset valuasi yang biasanya hanya ada di terminal mahal.',
    sections: [
      { title: 'Portofolio multi-aset', body: 'Saham IDX, crypto, reksa dana, emas, SBN, dan deposito dalam satu portofolio. Harga bergerak harian untuk holding ber-ticker, lengkap dengan untung/rugi.' },
      { title: 'Fair value dari 13 metode valuasi', body: 'Tiap emiten dinilai lewat DCF, Graham, EPV, DDM, NAV, dan metode lain — lalu dirangkum jadi satu fair value konsensus beserta margin of safety.' },
      { title: 'Rasio kunci & tren 5 tahun', body: 'PER, PBV, ROE, NPM, DER, free float, dan tren fundamental lima tahun. Ringkasan eksekutif membantu memahami angka tanpa harus membuka laporan keuangan mentah.' },
      { title: 'Struktur kepemilikan & dividen', body: 'Pemegang saham, anak usaha, dan kalender dividen untuk 1.000+ emiten — konteks yang jarang ada di aplikasi keuangan pribadi.' },
    ],
    faq: [
      { q: 'Datanya dari mana?', a: 'Fundamental dan struktur kepemilikan dari laporan keuangan publik emiten IDX; harga pasar dari data publik. Angka valuasi bersifat informatif, bukan nasihat atau anjuran beli/jual.' },
      { q: 'Apakah ini saran investasi?', a: 'Bukan. Klunting alat bantu riset dan pemantauan, bukan penasihat berlisensi. Selalu lakukan pertimbangan sendiri sebelum mengambil keputusan.' },
    ],
  },
  {
    slug: 'anggaran',
    name: 'Anggaran & arus kas',
    tagline: 'Anggaran bulanan maupun tahunan yang terasa seperti spreadsheet yang kamu kuasai.',
    icon: Wallet,
    shot: '/features/sankey.webp',
    shotAlt: 'Diagram aliran uang (Sankey) Klunting: dari Gaji & Side Hustle ke Total Pemasukan, lalu ke Tempat Tinggal, Makanan, Saham, dan kategori lain',
    intro:
      'Anggaran seharusnya fleksibel, bukan formulir kaku. Klunting memberi kontrol penuh sambil tetap menjaga gambaran besarnya.',
    sections: [
      { title: 'Bulanan dan tahunan', body: 'Susun anggaran per bulan maupun setahun penuh dalam grid 12 bulan. Lihat distribusi pemasukan, pengeluaran, tabungan, dan investasi sepanjang tahun.' },
      { title: 'Drag-fill & rumus di sel', body: 'Tarik nilai antar bulan seperti Excel, dan ketik rumus langsung di sel (mis. =12*250000). Kategori dan subkategori bisa diatur, diurutkan, dan dinonaktifkan.' },
      { title: 'Arus kas & diagram alur', body: 'Laporan arus kas bulanan plus diagram Sankey dari pemasukan ke pengeluaran — tahu persis ke mana uang mengalir.' },
      { title: 'Rencana vs realisasi', body: 'Bandingkan anggaran dengan realisasi tiap kategori, dengan peringatan saat sebuah pos mendekati atau melewati batas.' },
    ],
    faq: [
      { q: 'Mendukung gaya envelope / zero-based?', a: 'Ya. Buat kategori sesukamu, tetapkan batas per kategori, dan alokasikan sampai habis. Klunting fleksibel mengikuti gaya anggaranmu.' },
      { q: 'Bisa anggaran tahunan sekaligus?', a: 'Bisa. Grid 12 bulan memudahkan merencanakan setahun penuh, bukan hanya bulan berjalan.' },
    ],
  },
  {
    slug: 'pencatatan-ai',
    name: 'Pencatatan berbantuan AI',
    tagline: 'Catat transaksi dengan friksi sekecil mungkin supaya kamu konsisten.',
    icon: Sparkles,
    shot: '/features/transactions.webp',
    shotAlt: 'Daftar transaksi Klunting dengan ringkasan pemasukan, pengeluaran, arus kas bersih, dan filter',
    intro:
      'Frekuensi mencatat adalah indikator retensi nomor satu. Karena itu Klunting membuat pencatatan secepat dan semudah mungkin — dan gratis tanpa batas.',
    sections: [
      { title: 'Foto struk dibaca otomatis', body: 'Potret struk, AI membaca total, merchant, dan kategori, lalu mengisinya untukmu. Tinggal periksa dan simpan.' },
      { title: 'Catat dengan bahasa biasa', body: 'Ketik "indomaret 47rb cash" dan transaksi langsung rapi terkategori. Pencatatan via bahasa alami tidak memakan kredit — bebas sepuasnya.' },
      { title: 'Insight & playbook', body: 'Ringkasan pola pengeluaran bulanan, deteksi anomali, dan AI Playbook yang menyusun rencana finansial terarah: dana darurat, lunasi paylater, DP rumah.' },
      { title: 'Impor mutasi', body: 'Punya banyak transaksi lama? Impor mutasi rekening dari CSV atau PDF, dan biarkan Klunting merapikannya.' },
    ],
    faq: [
      { q: 'Pencatatan AI makan kredit?', a: 'Tidak. Mencatat transaksi via foto struk atau bahasa biasa gratis tanpa batas. Hanya fitur berat seperti riset saham mendalam yang ber-kuota.' },
      { q: 'Datanya dikirim ke mana?', a: 'Fitur AI memakai Claude (Anthropic). Hanya teks/gambar yang kamu berikan yang dikirim; tidak dipakai melatih model. Detail di Kebijakan Privasi.' },
    ],
  },
  {
    slug: 'utang',
    name: 'Manajemen utang',
    tagline: 'Lihat seluruh kewajiban dan jalur tercepat untuk bebas darinya.',
    icon: CreditCard,
    shot: '/features/debts.webp',
    shotAlt: 'Halaman utang Klunting: total utang, cicilan bulanan, rasio DTI, daftar utang, dan strategi snowball vs avalanche',
    intro:
      'Utang yang tersebar bikin sulit melihat ujungnya. Klunting menyatukannya dan menunjukkan strategi pelunasan paling efisien.',
    sections: [
      { title: 'Semua utang dalam satu daftar', body: 'KPR, KTA, kartu kredit, dan paylater. Lihat sisa pokok, bunga, jadwal pembayaran, dan estimasi tanggal lunas.' },
      { title: 'Strategi pelunasan', body: 'Bandingkan metode avalanche (bunga tertinggi dulu) dan snowball (saldo terkecil dulu), dengan simulasi efek cicilan ekstra.' },
      { title: 'Rasio kesehatan (DTI)', body: 'Rasio utang terhadap pendapatan sebagai indikator apakah bebanmu masih sehat.' },
      { title: 'Terhubung ke net worth', body: 'Setiap pembayaran utang langsung tercermin di net worth dan proyeksi bebas utang.' },
    ],
    faq: [
      { q: 'Bisa simulasi pelunasan dipercepat?', a: 'Bisa. Tambahkan cicilan ekstra dan lihat berapa bulan dan bunga yang bisa dihemat.' },
    ],
  },
  {
    slug: 'keluarga',
    name: 'Berbagi dengan keluarga',
    tagline: 'Kelola keuangan bersama pasangan atau keluarga tanpa kehilangan privasi.',
    icon: Users,
    shot: '/features/keluarga.webp',
    shotAlt: 'Halaman keluarga Klunting: ajak pasangan/keluarga sampai 4 anggota, dengan alur Buat keluarga → Undang anggota → Kelola bareng',
    intro:
      'Keuangan rumah tangga sering melibatkan lebih dari satu orang. Paket Max memungkinkan berbagi tanpa harus saling membuka semua hal.',
    sections: [
      { title: 'Hingga 5 anggota', body: 'Satu rumah tangga, sampai lima anggota, dalam paket Max.' },
      { title: 'Tujuan & dompet bersama', body: 'Tujuan, anggaran, dan dompet bersama yang bisa dipantau semua anggota.' },
      { title: 'Rincian per anggota', body: 'Lihat siapa membelanjakan apa, sambil tetap bisa memisahkan pengeluaran pribadi bila diinginkan.' },
    ],
    faq: [
      { q: 'Apakah semua anggota melihat semua data?', a: 'Yang dibagikan adalah tujuan, anggaran, dan dompet bersama. Pengeluaran pribadi tetap dapat dipisahkan.' },
    ],
  },
  {
    slug: 'keamanan',
    name: 'Keamanan & privasi',
    tagline: 'Data finansial adalah data sensitif. Kami memperlakukannya seperti itu.',
    icon: Shield,
    shot: '/features/keamanan.webp',
    shotAlt: 'Pengaturan keamanan Klunting: ganti password, autentikasi dua faktor (2FA), aktivitas keamanan, dan PIN Lock',
    intro:
      'Privasi bukan fitur tambahan, tapi fondasi. Model bisnis Klunting adalah langganan — bukan datamu.',
    sections: [
      { title: 'Enkripsi & isolasi', body: 'Komunikasi dienkripsi TLS, password di-hash satu arah (bcrypt), dan Row Level Security mengisolasi data antar pengguna di level database.' },
      { title: 'Kontrol akses', body: 'Autentikasi dua faktor (2FA), PIN/biometrik perangkat, dan Calm Mode untuk menyembunyikan angka di tempat umum.' },
      { title: 'Datamu milikmu', body: 'Ekspor seluruh data ke CSV kapan saja, dan hapus akun permanen bila mau. Tidak ada iklan, dan data tidak dijual.' },
    ],
    faq: [
      { q: 'Apakah data saya dijual?', a: 'Tidak, tidak pernah. Tidak ada iklan dan tidak ada penjualan data. Pemasukan kami murni dari langganan.' },
    ],
  },
]

export const getFeature = (slug: string): Feature | undefined =>
  FEATURES.find((f) => f.slug === slug)
