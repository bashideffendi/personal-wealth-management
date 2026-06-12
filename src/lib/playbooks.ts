/**
 * Playbook — panduan finansial ID-native terstruktur, dengan rencana yang
 * dipersonalisasi Claude. Data di sini PURE (tanpa React/ikon) biar bisa
 * dipakai server & client. Ikon di-resolve via `iconKey` di komponen.
 *
 * Angka di `steps` sengaja diframe sebagai KISARAN edukatif (bukan klaim
 * pasti) — angka pasti berubah tiap tahun & per daerah. Personalisasi
 * (angka riil user) terjadi di rencana AI, bukan di template.
 */

export type PlaybookInputType = 'number' | 'select'

export interface PlaybookInputField {
  key: string
  label: string
  type: PlaybookInputType
  /** Untuk type 'number' — placeholder input. */
  placeholder?: string
  /** Untuk type 'select' — opsi. */
  options?: { value: string; label: string }[]
  /** Prefix unit (mis. "Rp") untuk number. */
  prefix?: string
  /** Izinkan satu pemisah desimal (mis. bunga 2,5%). Default integer-only. */
  decimal?: boolean
  hint?: string
  /** Coba prefill dari data user: 'monthlyExpense' | 'monthlyIncome' | 'liquidSavings'. */
  prefillFrom?: 'monthlyExpense' | 'monthlyIncome' | 'liquidSavings'
}

export interface PlaybookStep {
  title: string
  detail: string
}

export interface Playbook {
  slug: string
  title: string
  tagline: string
  /** key ikon lucide (di-resolve di komponen). */
  iconKey: string
  /** token warna aksen, mis. 'var(--c-mint)'. */
  accent: string
  intro: string
  steps: PlaybookStep[]
  inputs: PlaybookInputField[]
  related?: { label: string; href: string }
}

export const PLAYBOOKS: Playbook[] = [
  {
    slug: 'dana-darurat',
    title: 'Dana Darurat',
    tagline: 'Bantalan buat keadaan tak terduga',
    iconKey: 'piggy-bank',
    accent: 'var(--c-mint)',
    intro:
      'Dana darurat adalah uang yang gampang dicairkan buat nutup kebutuhan saat pemasukan mendadak hilang atau ada pengeluaran besar tak terduga. Idealnya disimpan terpisah dari rekening harian.',
    steps: [
      {
        title: 'Tentukan target',
        detail:
          'Umumnya 3–6× pengeluaran bulanan. Single & penghasilan stabil bisa di 3–4×; punya tanggungan atau penghasilan tidak tetap (freelance, usaha) sebaiknya 6–12×.',
      },
      {
        title: 'Pisahkan rekeningnya',
        detail:
          'Taruh di rekening/instrumen terpisah dari rekening belanja harian biar nggak kepakai. Hindari mencampur dengan dana investasi berisiko.',
      },
      {
        title: 'Isi bertahap',
        detail:
          'Set autodebet rutin tiap gajian. Mulai dari 1 bulan pengeluaran dulu sebagai milestone pertama, baru naik ke target penuh.',
      },
      {
        title: 'Simpan di instrumen likuid',
        detail:
          'Tabungan, deposito yang bisa dicairkan, atau Reksa Dana Pasar Uang (RDPU). Prioritas: bisa dicairkan cepat (≤1 hari) dan nilainya stabil — bukan saham/kripto.',
      },
      {
        title: 'Pakai & isi ulang',
        detail:
          'Kalau kepakai, prioritaskan mengisinya kembali sebelum lanjut nabung tujuan lain. Dana darurat = garis pertahanan, harus selalu penuh.',
      },
    ],
    inputs: [
      { key: 'monthlyExpense', label: 'Pengeluaran rutin per bulan', type: 'number', prefix: 'Rp', placeholder: '5.000.000', prefillFrom: 'monthlyExpense' },
      {
        key: 'multiplier',
        label: 'Target (kali pengeluaran bulanan)',
        type: 'select',
        options: [
          { value: '3', label: '3× — single, penghasilan stabil' },
          { value: '6', label: '6× — standar, punya tanggungan' },
          { value: '12', label: '12× — penghasilan tidak tetap' },
        ],
      },
      { key: 'currentSaved', label: 'Sudah terkumpul', type: 'number', prefix: 'Rp', placeholder: '0', prefillFrom: 'liquidSavings' },
      { key: 'monthlyContribution', label: 'Sanggup nabung per bulan', type: 'number', prefix: 'Rp', placeholder: '1.000.000' },
    ],
    related: { label: 'Buka halaman Dana Darurat', href: '/dashboard/emergency-fund' },
  },
  {
    slug: 'lunasi-paylater',
    title: 'Bebas Paylater & Utang',
    tagline: 'Strategi cepat lepas dari cicilan konsumtif',
    iconKey: 'credit-card',
    accent: 'var(--c-coral)',
    intro:
      'Utang konsumtif (paylater, KTA, cicilan kartu kredit) sering punya bunga efektif tinggi. Tujuan playbook ini: berhenti nambah utang baru, lalu lunasi yang ada secepat mungkin dengan urutan yang paling hemat bunga.',
    steps: [
      {
        title: 'Daftar semua utang',
        detail:
          'Catat tiap utang: sisa pokok, bunga/biaya per bulan, dan cicilan minimum. Termasuk paylater (Shopee/Gojek/Akulaku dll), KTA, dan saldo kartu kredit.',
      },
      {
        title: 'Stop pemakaian baru',
        detail:
          'Matikan fitur paylater & simpan kartu kredit dulu. Lubang harus berhenti membesar sebelum bisa ditutup.',
      },
      {
        title: 'Pilih metode',
        detail:
          'Avalanche (bayar bunga tertinggi dulu) = paling hemat secara matematika. Snowball (saldo terkecil dulu) = menang momentum psikologis. Keduanya valid — pilih yang bikin kamu konsisten.',
      },
      {
        title: 'Alokasikan dana ekstra',
        detail:
          'Bayar minimum di semua utang, lalu lempar semua sisa uang ke satu utang prioritas. Setelah lunas, "bola salju" cicilannya pindah ke utang berikutnya.',
      },
      {
        title: 'Lacak & rayakan',
        detail:
          'Pantau sisa utang turun tiap bulan. Tiap satu utang lunas = milestone. Setelah semua bersih, alihkan cicilan tadi ke dana darurat & investasi.',
      },
    ],
    inputs: [
      { key: 'totalDebt', label: 'Total sisa utang', type: 'number', prefix: 'Rp', placeholder: '15.000.000' },
      { key: 'avgInterest', label: 'Bunga rata-rata per bulan (%)', type: 'number', placeholder: '3', decimal: true },
      { key: 'monthlyPayment', label: 'Sanggup bayar per bulan', type: 'number', prefix: 'Rp', placeholder: '2.000.000' },
      {
        key: 'method',
        label: 'Metode pelunasan',
        type: 'select',
        options: [
          { value: 'avalanche', label: 'Avalanche — bunga tertinggi dulu (hemat)' },
          { value: 'snowball', label: 'Snowball — saldo terkecil dulu (momentum)' },
        ],
      },
    ],
    related: { label: 'Buka Strategi Pelunasan Utang', href: '/dashboard/debts/strategy' },
  },
  {
    slug: 'dp-rumah',
    title: 'DP Rumah (KPR)',
    tagline: 'Siapkan uang muka & biaya KPR',
    iconKey: 'home',
    accent: 'var(--c-violet)',
    intro:
      'Beli rumah lewat KPR butuh uang muka (DP) plus biaya-biaya di awal yang sering kelupaan. Playbook ini bantu hitung total dana yang perlu disiapkan dan kecepatan menabungnya.',
    steps: [
      {
        title: 'Tentukan harga & DP',
        detail:
          'DP KPR umumnya 10–20% dari harga rumah (rumah pertama bisa lebih rendah lewat program tertentu). Makin besar DP, makin ringan cicilan & bunga.',
      },
      {
        title: 'Hitung biaya tersembunyi',
        detail:
          'Selain DP, siapkan ±7–10% harga rumah untuk biaya: BPHTB (pajak pembeli), biaya notaris/AJB, balik nama, provisi & administrasi bank, plus asuransi. Jangan sampai kehabisan dana di sini.',
      },
      {
        title: 'Cek kemampuan cicilan',
        detail:
          'Bank biasanya membatasi cicilan maksimal ±30–35% dari penghasilan bulanan. Pastikan estimasi cicilan masih masuk batas ini sebelum mengejar DP.',
      },
      {
        title: 'Pilih instrumen sesuai tenor',
        detail:
          'Target <3 tahun: instrumen aman (deposito, RDPU, SBN ritel). 3–5 tahun: boleh campur reksa dana pendapatan tetap. Hindari aset volatil untuk dana yang segera dipakai.',
      },
      {
        title: 'Nabung otomatis & pantau',
        detail:
          'Set autodebet bulanan ke rekening tujuan DP. Review tiap 6 bulan — harga properti & suku bunga bergerak, sesuaikan target bila perlu.',
      },
    ],
    inputs: [
      { key: 'housePrice', label: 'Perkiraan harga rumah', type: 'number', prefix: 'Rp', placeholder: '500.000.000' },
      {
        key: 'dpPercent',
        label: 'Persentase DP',
        type: 'select',
        options: [
          { value: '10', label: '10%' },
          { value: '15', label: '15%' },
          { value: '20', label: '20% (cicilan paling ringan)' },
          { value: '30', label: '30%' },
        ],
      },
      { key: 'years', label: 'Target terkumpul (tahun)', type: 'number', placeholder: '3' },
      { key: 'currentSaved', label: 'Sudah terkumpul', type: 'number', prefix: 'Rp', placeholder: '20.000.000' },
      { key: 'monthlyIncome', label: 'Penghasilan per bulan', type: 'number', prefix: 'Rp', placeholder: '15.000.000', prefillFrom: 'monthlyIncome' },
    ],
    related: { label: 'Bikin tujuan ini di Tujuan', href: '/dashboard/goals' },
  },
  {
    slug: 'haji-umrah',
    title: 'Haji & Umrah',
    tagline: 'Rencana menabung ke Tanah Suci',
    iconKey: 'plane',
    accent: 'var(--c-amber)',
    intro:
      'Biaya haji dan umrah cukup besar dan ada antrian (untuk haji reguler). Playbook ini bantu menyusun target tabungan dan ritme menabungnya, sesuai jenis ibadah yang dituju.',
    steps: [
      {
        title: 'Tentukan jenis & estimasi biaya',
        detail:
          'Umrah: kisaran biaya per orang umumnya puluhan juta rupiah tergantung paket & musim. Haji reguler: ada setoran awal untuk mendapat nomor porsi, lalu pelunasan saat keberangkatan tiba. Angka resmi berubah tiap tahun — cek penyelenggara/Kemenag.',
      },
      {
        title: 'Pahami antrian (khusus haji)',
        detail:
          'Haji reguler punya masa tunggu bertahun-tahun setelah dapat porsi. Makin cepat setor porsi, makin cepat masuk antrian. Umrah tidak ada antrian, bisa kapan saja dananya siap.',
      },
      {
        title: 'Buka tabungan khusus',
        detail:
          'Banyak bank syariah punya produk Tabungan Haji/Umrah yang terhubung ke sistem porsi. Memisahkan dana ini menghindari tergerus kebutuhan lain.',
      },
      {
        title: 'Nabung rutin & konsisten',
        detail:
          'Pecah target jadi setoran bulanan. Untuk dana yang dipakai >3 tahun lagi, boleh sebagian di instrumen syariah berimbal hasil (mis. reksa dana syariah) — sesuaikan profil risiko.',
      },
    ],
    inputs: [
      {
        key: 'type',
        label: 'Jenis ibadah',
        type: 'select',
        options: [
          { value: 'umrah', label: 'Umrah' },
          { value: 'haji', label: 'Haji reguler (setoran porsi)' },
        ],
      },
      { key: 'costPerPerson', label: 'Estimasi biaya per orang', type: 'number', prefix: 'Rp', placeholder: '35.000.000' },
      { key: 'people', label: 'Jumlah orang', type: 'number', placeholder: '1' },
      { key: 'years', label: 'Target berangkat (tahun lagi)', type: 'number', placeholder: '4' },
      { key: 'currentSaved', label: 'Sudah terkumpul', type: 'number', prefix: 'Rp', placeholder: '0' },
    ],
    related: { label: 'Bikin tujuan ini di Tujuan', href: '/dashboard/goals' },
  },
  {
    slug: 'qurban',
    title: 'Qurban Tahunan',
    tagline: 'Nabung rutin biar tiap tahun bisa berqurban',
    iconKey: 'sprout',
    accent: 'var(--c-mint)',
    intro:
      'Qurban itu agenda tahunan, jadi paling enak disiapkan dengan menabung sedikit-sedikit tiap bulan — bukan nyari dana mendadak menjelang Iduladha. Playbook ini menghitung setoran bulanan dari target biaya hewan.',
    steps: [
      {
        title: 'Pilih jenis hewan',
        detail:
          'Kambing/domba untuk 1 orang, atau sapi yang bisa dipatungani hingga 7 orang. Harga bervariasi per daerah, bobot, dan menjelang hari-H biasanya naik — survei harga lebih awal lebih hemat.',
      },
      {
        title: 'Tetapkan target biaya',
        detail:
          'Tentukan kisaran harga hewan yang dituju (boleh patungan sapi untuk menekan biaya per orang). Tambahkan sedikit buffer untuk kenaikan harga musiman.',
      },
      {
        title: 'Hitung mundur ke Iduladha',
        detail:
          'Bagi target dengan jumlah bulan tersisa sampai Iduladha berikutnya. Ini jadi setoran bulanan "tabungan qurban".',
      },
      {
        title: 'Otomatiskan & jadwalkan beli',
        detail:
          'Set autodebet rutin ke rekening/amplop khusus qurban. Beli H-2 sampai H-3 minggu untuk dapat pilihan & harga lebih baik daripada beli mepet hari-H.',
      },
    ],
    inputs: [
      {
        key: 'animal',
        label: 'Jenis qurban',
        type: 'select',
        options: [
          { value: 'kambing', label: 'Kambing/domba (1 orang)' },
          { value: 'sapi_patungan', label: 'Sapi patungan (1/7)' },
          { value: 'sapi_utuh', label: 'Sapi utuh (7 orang)' },
        ],
      },
      { key: 'targetCost', label: 'Target biaya', type: 'number', prefix: 'Rp', placeholder: '3.500.000' },
      { key: 'monthsLeft', label: 'Bulan tersisa ke Iduladha', type: 'number', placeholder: '8' },
      { key: 'currentSaved', label: 'Sudah terkumpul', type: 'number', prefix: 'Rp', placeholder: '0' },
    ],
    related: { label: 'Bikin tujuan ini di Tujuan', href: '/dashboard/goals' },
  },
]

export function getPlaybook(slug: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.slug === slug)
}
