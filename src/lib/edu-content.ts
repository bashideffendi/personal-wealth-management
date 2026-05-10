/**
 * Educational tooltip content registry — single source of truth for
 * the "Why this works?" mini-lessons sprinkled across the app.
 *
 * Design philosophy:
 *   - Casual Indonesian tone, not academic lecture
 *   - 50-80 words body max — anything longer kills the popover
 *   - 1 source citation in italic at the bottom for credibility
 *   - Optional "applied" line that ties theory back to what PWM does
 *
 * If an entry is missing or you want to A/B test copy, change it here
 * and every site picks up the update automatically.
 */

export interface EduContent {
  /** Short title — shows as the popover header */
  title: string
  /** 50-80 word explanation in casual Indonesian */
  body: string
  /** How PWM applies this theory — optional but recommended */
  applied?: string
  /** Source citation — author, work, year */
  source: string
}

export const EDU_TIPS: Record<string, EduContent> = {
  // ── Budgeting methods ────────────────────────────────────────────
  'budget-method': {
    title: 'Metode Budgeting',
    body: 'Ada banyak filosofi budgeting. Yang populer: 50/30/20 (Warren) — 50% needs, 30% wants, 20% saving. Atau Zero-Based Budgeting (Pyhrr/YNAB) — setiap rupiah dapat "pekerjaan" sampai sisa = 0. Atau Kakeibo (Jepang) — refleksi sebelum belanja besar.',
    applied: 'PWM pakai grid 12-bulan supaya kamu bisa pilih sendiri — bisa pakai 50/30/20 (set 3 kategori) atau ZBB (alokasi semua kategori sampai habis).',
    source: 'Warren & Tyagi, "All Your Worth" (2005); Pyhrr (1970), YNAB',
  },

  // ── Mental Accounting (Thaler) ───────────────────────────────────
  'mental-accounting': {
    title: 'Mental Accounting',
    body: 'Otak manusia naluri memisahkan uang ke "kantong" mental berdasarkan tujuan — meskipun secara matematis semua = uang. Memberi nama spesifik ("Dana Umroh", "DP Rumah") meningkatkan disiplin saving karena bikin uangnya terasa "bukan untuk dipakai".',
    applied: 'Goals di PWM sengaja dipisah-pisah — bukan satu pot tabungan. Itu bukan inefisiensi, tapi behavioral feature.',
    source: 'Thaler, "Mental Accounting Matters" (1999)',
  },

  // ── Goal-Based / Behavioral Portfolio Theory ────────────────────
  'goal-based-investing': {
    title: 'Goal-Based Investing',
    body: 'Daripada cuma kejar return tinggi, setiap goal punya horizon dan risk profile berbeda. Dana darurat (1 thn) ≠ dana pensiun (30 thn). Behavioral Portfolio Theory bilang investor sehat punya 3 lapisan: pelindung (cash, deposito), stabil (RD campuran, SBN), dan agresif (saham, kripto).',
    applied: 'PWM mengizinkan kamu set goals terpisah — supaya kamu nggak tergoda jual saham buat darurat (yg bisa bikin rugi karena timing).',
    source: 'Shefrin & Statman, "Behavioral Portfolio Theory" (2000)',
  },

  // ── Diversification (MPT — Markowitz) ───────────────────────────
  'diversification': {
    title: 'Diversifikasi',
    body: 'Jangan taruh semua telur di satu keranjang. Risiko portofolio bukan rata-rata risiko aset individu — tapi fungsi kovarians antar aset. Diversifikasi mengurangi risiko tanpa harus kurangi expected return. Markowitz dapat Nobel 1990 karena menemukan ini.',
    applied: 'Mix saham, obligasi, emas, dan crypto — pas satu jatuh, yang lain biasanya nggak ikut jatuh.',
    source: 'Markowitz, "Portfolio Selection" (1952)',
  },

  // ── DCA (Dollar Cost Averaging) ─────────────────────────────────
  'dca': {
    title: 'Dollar Cost Averaging',
    body: 'Investasi rutin dengan jumlah tetap (misal Rp 1jt/bulan) — terlepas dari harga pasar. Saat harga turun, kamu dapat lebih banyak unit. Saat naik, dapat lebih sedikit. Mengurangi risiko timing yg salah dan disiplinin kebiasaan. Studi Vanguard: lump sum sebenernya menang ~67% kasus, tapi DCA menang secara behavioral retention.',
    applied: 'Cocok dipakai untuk gaji bulanan — auto-debit ke RD/saham di tanggal gajian.',
    source: 'Bogle, "Common Sense on Mutual Funds" (1999)',
  },

  // ── Snowball vs Avalanche ───────────────────────────────────────
  'debt-strategy': {
    title: 'Snowball vs Avalanche',
    body: 'Dua filosofi pelunasan utang. Snowball: bayar saldo terkecil dulu — secara psikologis dapat "quick wins" yang mempertahankan motivasi. Avalanche: bayar bunga tertinggi dulu — secara matematika paling hemat. Avalanche unggul angka, Snowball unggul retention.',
    applied: 'PWM kasih kamu toggle — pilih sesuai tipe kamu. Default Avalanche (matematis), tapi nggak ada salahnya pilih Snowball kalau butuh motivasi.',
    source: 'Ramsey, "Total Money Makeover" (2003); McAllister (2018)',
  },

  // ── Permanent Income Hypothesis (PIH) ───────────────────────────
  'permanent-income': {
    title: 'Permanent vs Temporary Income',
    body: 'Pendapatan reguler (gaji) idealnya membentuk lifestyle. Pendapatan temporer (THR, bonus, refund) sebaiknya jangan ikut menaikkan standar hidup — karena tahun depan belum tentu ada lagi. MPC dari pendapatan permanen tinggi, dari temporer mendekati nol — secara teori, sebagian besar windfall harusnya ditabung.',
    applied: 'Tip: setiap THR/bonus masuk, default-kan ke buffer atau pelunasan utang dulu. Sisanya baru lifestyle.',
    source: 'Friedman, "A Theory of the Consumption Function" (1957)',
  },

  // ── Emergency Fund / Buffer Stock ───────────────────────────────
  'emergency-fund': {
    title: 'Dana Darurat',
    body: 'Idealnya 3-6× pengeluaran bulanan untuk pekerja tetap, atau 6-12× untuk freelancer/gig worker. Disimpan di instrumen likuid (tabungan, deposito, RD pasar uang) — bukan saham. Tujuannya: cover kalau income hilang mendadak, tanpa harus jual aset di waktu yg salah.',
    applied: 'Hitungannya: total pengeluaran wajib bulanan × multiplier (3-12 tergantung profil kamu).',
    source: 'Carroll, "Buffer-Stock Saving and the Life Cycle/Permanent Income Hypothesis" (1997)',
  },

  // ── Loss Aversion (Kahneman-Tversky) ────────────────────────────
  'loss-aversion': {
    title: 'Loss Aversion',
    body: 'Otak kita merasakan kerugian sekitar 2× lebih sakit daripada keuntungan setara. Inilah kenapa banyak investor "panic sell" saat market turun, atau menahan saham loser kelamaan berharap balik. Kesimpulan: hindari decision investasi saat emosi tinggi — tunggu 24 jam.',
    applied: 'PWM tunjukin progress goal (gain framing), bukan cuma P/L harian — ini supaya kamu nggak overreact ke noise jangka pendek.',
    source: 'Kahneman & Tversky, "Prospect Theory" (1979)',
  },

  // ── Compound Interest / Rule of 72 ──────────────────────────────
  'compound-interest': {
    title: 'Bunga Berbunga (Compound)',
    body: 'Kekuatan terbesar dalam personal finance — sekaligus paling berbahaya kalau di sisi utang. Rule of 72: investasi return 8% double dalam 9 tahun (72÷8). Sebaliknya: kartu kredit bunga 27%/thn → utang Rp 5jt jadi Rp 6,35jt setahun kalau cuma min payment.',
    applied: 'Itu kenapa lunasi kartu kredit dulu sebelum mikirin investasi return tinggi. Mathematics-nya jelas.',
    source: 'Einstein (apokrif): "Compound interest is the eighth wonder of the world."',
  },

  // ── Cash-flow budgeting ─────────────────────────────────────────
  'cash-flow': {
    title: 'Cash-Flow Budgeting',
    body: 'Bukan cuma berapa total pengeluaran sebulan — tapi juga timing-nya. Gajian tanggal 25, tagihan KPR tanggal 5, kartu kredit tanggal 15. Kalau timing salah, bisa overdraft meskipun bulan-end positif. Forecast harian/mingguan jauh lebih informatif daripada laporan bulan-end.',
    applied: 'Berguna banget buat freelancer/gig worker yg pendapatannya tidak rata.',
    source: 'CFPB Cash Flow Budget Tool (2021)',
  },

  // ── Save More Tomorrow (Thaler-Benartzi) ────────────────────────
  'save-more-tomorrow': {
    title: 'Save More Tomorrow',
    body: 'Strategi Thaler-Benartzi (2004): commit naikkan savings rate +1% setiap 3 bulan, sampai target tercapai. Powerful karena pre-commitment di awal (sebelum loss aversion kena), bukan tiap kali kamu liat saldo. Studi 401(k) US: partisipasi naik dari 49% → 86% dengan SMT.',
    applied: 'Set target sekarang (saat motivasi tinggi), app reminder kamu setiap 3 bulan untuk bump kontribusi. Increment kecil per kuartal = lompatan besar dalam 2-3 tahun.',
    source: 'Thaler & Benartzi, "Save More Tomorrow" (Journal of Political Economy 2004)',
  },

  // ── Wealth Pyramid (HFN) ────────────────────────────────────────
  'wealth-pyramid': {
    title: 'Hierarchy of Financial Needs',
    body: 'Adaptasi Maslow untuk personal finance. 5 tier: Foundation (cashflow stabil) → Safety (dana darurat + asuransi) → Accumulation (goal aktif + investasi rutin) → Growth (investasi 3× annual income + dana pensiun) → Legacy (FI + estate planning). Idealnya kuatkan dasar dulu sebelum naik.',
    applied: 'Tier yg belum tercapai dikunci visual — fokus dulu ke yg paling rendah belum kelar. Lebih baik 5/5 di tier 1-3 daripada loncat ke tier 4 dengan dasar rapuh.',
    source: 'Mission Asset Fund HFN; adaptasi Maslow (1943) untuk financial planning',
  },

  // ── DTI / DSR ───────────────────────────────────────────────────
  'dti-ratio': {
    title: 'DTI / Debt Service Ratio',
    body: 'Total cicilan utang per bulan dibagi income kotor. Aturan klasik 28/36: cicilan rumah ≤28%, total semua cicilan ≤36%. OJK menyebut zona aman 30-35% take-home pay. Lewat 50%, hidup jadi sangat rapuh — sedikit shock bisa bikin gagal bayar.',
    applied: 'Marker di bar nunjukin posisi kamu vs zona aman/warning. Hijau = sehat, merah = risiko tinggi.',
    source: 'CFPB 28/36 rule; OJK guideline DSR konsumer',
  },

  // ── Financial Health Score ──────────────────────────────────────
  'financial-health': {
    title: 'Skor Kesehatan Finansial',
    body: 'Score 0-100 yang ringkas kondisi keuanganmu di 7 indikator: savings rate, dana darurat, DTI, status utang, asuransi, investasi jangka panjang, dan progress goal. Tier: Vulnerable <40, Coping 40-59, Healthy 60-79, Thriving 80+. Bukan vonis — ini diagnostic tool untuk tau prioritas mana yang harus diperkuat.',
    applied: 'Indikator yg datanya belum ada (misal asuransi, atau kalau belum catat income) ditandai N/A — bukan diitung 0. Jadi user baru ngga langsung kena skor jelek.',
    source: 'Financial Health Network (CFSI 2016, refined 2024) — adaptasi konteks Indonesia',
  },

  // ── 50/30/20 specifically ───────────────────────────────────────
  'fifty-thirty-twenty': {
    title: '50/30/20',
    body: 'Aturan paling sederhana dari Senator Elizabeth Warren. Dari take-home: 50% kebutuhan (sewa, makan, transport, tagihan), 30% keinginan (hiburan, hobi, makan luar), 20% saving + bayar utang ekstra. Cocok untuk pemula yang butuh starting framework — bukan untuk income rendah/extreme.',
    applied: 'Untuk kota besar (Jakarta UMR), sering perlu disesuaikan ke 60/20/20 atau 70/15/15.',
    source: 'Warren & Tyagi, "All Your Worth" (2005)',
  },
}

/** Get a tip by key with type-safety */
export function getEduTip(key: keyof typeof EDU_TIPS): EduContent {
  return EDU_TIPS[key]
}
