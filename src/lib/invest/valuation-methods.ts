/**
 * Valuation method documentation — origin, formula, suitability by sector.
 *
 * Sector suitability uses three tiers:
 *   - "ideal":  method best-suited, results most reliable
 *   - "works":  method applicable, interpret normally
 *   - "avoid":  method fundamentally misfits this sector — treat output as
 *              very rough / ignore
 *
 * IDX-IC sector classification:
 *   Financials, Energy, Basic Materials, Industrials, Consumer Cyclicals,
 *   Consumer Non-Cyclicals, Healthcare, Technology, Infrastructures,
 *   Properties & Real Estate, Transportation & Logistic, Utilities
 */

export type Suitability = "ideal" | "works" | "avoid";

export interface MethodInfo {
  /** Key used in valuation engine results */
  key: string;
  /** Display label */
  label: string;
  /** Short tagline */
  tagline: string;
  /** Who developed / popularized the method */
  origin: string;
  /** Year of origin / key publication */
  year: string;
  /** Human-readable formula */
  formula: string;
  /** 1-3 sentences on how it works */
  howItWorks: string;
  /** Best-suited scenarios */
  bestFor: string[];
  /** Known limitations */
  limitations: string[];
  /** Data the method needs to produce a valid answer */
  requires: string[];
  /** Sector-level suitability map (default: "works" if unspecified) */
  sectorSuitability: Partial<Record<string, Suitability>>;
  /** When method is marked "avoid" for a sector, this explains why */
  avoidReasons: Partial<Record<string, string>>;
}

export const METHOD_INFO: Record<string, MethodInfo> = {
  DCF: {
    key: "DCF",
    label: "Discounted Cash Flow (DCF)",
    tagline: "Nilai intrinsik = present value dari arus kas bebas di masa depan.",
    origin: "John Burr Williams — 'The Theory of Investment Value' (1938). Populer lewat Warren Buffett & Aswath Damodaran.",
    year: "1938",
    formula: "FV = Σ(FCF_t / (1+r)^t) + Terminal Value / (1+r)^n − Net Debt, all ÷ shares",
    howItWorks:
      "Proyeksikan Free Cash Flow selama 5 tahun ke depan pakai CAGR historis (di-cap 15% supaya tidak terlalu optimistis), tambahkan nilai perpetuitas pada akhir tahun ke-5 (Gordon growth, g=3%), diskon semuanya ke nilai sekarang dengan cost of equity 13.75%, lalu kurangi net debt untuk dapat equity value per saham.",
    bestFor: [
      "Perusahaan mature dengan FCF stabil dan positif",
      "Industri consumer staples, manufacturing, utilities",
      "Bisnis dengan revenue model yang predictable",
    ],
    limitations: [
      "Sangat sensitif terhadap asumsi growth & discount rate (garbage in, garbage out)",
      "Tidak cocok untuk perusahaan cyclical (FCF naik-turun drastis)",
      "Tidak cocok untuk perusahaan growth tanpa FCF positif",
      "Bank/asuransi: definisi 'cash flow' mereka beda, hasilnya misleading",
    ],
    requires: ["Free Cash Flow positif (latest year)", "Historical FCF ≥ 2 tahun", "Jumlah saham beredar"],
    sectorSuitability: {
      "Consumer Non-Cyclicals": "ideal",
      "Healthcare": "ideal",
      "Utilities": "ideal",
      "Industrials": "works",
      "Consumer Cyclicals": "works",
      "Technology": "works",
      "Infrastructures": "works",
      "Transportation & Logistic": "works",
      "Energy": "avoid",
      "Basic Materials": "avoid",
      "Financials": "avoid",
      "Properties & Real Estate": "avoid",
    },
    avoidReasons: {
      "Financials": "Bank & asuransi: cash flow didominasi aktivitas pendanaan (deposits, claims), bukan operasi. DCF standar tidak applicable — pakai DDM atau Rel PBV.",
      "Energy": "Komoditas siklikal — FCF satu tahun bisa anomali. Growth projection pakai CAGR historis sangat misleading.",
      "Basic Materials": "Sama dengan Energy — commodity price cycles bikin projection tidak reliable.",
      "Properties & Real Estate": "Nilai utama di aset tanah/bangunan, bukan cash flow operasi. Pakai NAV.",
    },
  },

  Graham: {
    key: "Graham",
    label: "Graham Number (klasik)",
    tagline: "Formula cepat Benjamin Graham untuk saham defensif.",
    origin: "Benjamin Graham — 'Security Analysis' (1934) & 'The Intelligent Investor' (1949). Mentor Warren Buffett.",
    year: "1949",
    formula: "FV = √(22.5 × EPS × BVPS)",
    howItWorks:
      "Kombinasi earnings + book value dalam satu angka sederhana. 22.5 berasal dari batas Graham: PER maksimal 15 × PBV maksimal 1.5. Konsep: saham dengan P ≤ √(22.5 × EPS × BVPS) terlindungi oleh kombinasi earnings yield yang masuk akal dan asset backing.",
    bestFor: [
      "Saham value/defensif dengan earnings stabil",
      "Perusahaan mature dengan aset jelas",
      "Sebagai lower-bound check sebelum kombinasi dengan metode lain",
    ],
    limitations: [
      "Tidak memperhitungkan growth — saham bertumbuh selalu terlihat 'mahal'",
      "Gagal untuk perusahaan rugi (EPS negatif)",
      "Kurang relevan untuk intangible-heavy (tech, brand) dimana BVPS tidak mencerminkan nilai sebenarnya",
      "Angka 22.5 berdasarkan kondisi pasar US 1940-an",
    ],
    requires: ["EPS positif", "BVPS positif"],
    sectorSuitability: {
      "Financials": "works",
      "Industrials": "ideal",
      "Consumer Non-Cyclicals": "ideal",
      "Properties & Real Estate": "works",
      "Basic Materials": "works",
      "Utilities": "ideal",
      "Infrastructures": "works",
      "Transportation & Logistic": "works",
      "Consumer Cyclicals": "works",
      "Technology": "avoid",
      "Healthcare": "works",
      "Energy": "works",
    },
    avoidReasons: {
      "Technology": "Perusahaan tech umumnya intangible-heavy (IP, brand, platform). BVPS dari neraca undervalued aset sebenarnya — Graham akan memberikan fair value yang terlalu rendah.",
    },
  },

  "Graham Revised": {
    key: "Graham Revised",
    label: "Graham Revised (with growth)",
    tagline: "Formula Graham versi dewasa, memasukkan faktor pertumbuhan & yield bond.",
    origin: "Benjamin Graham — revisi di edisi revisi 'The Intelligent Investor' (1962 & 1973).",
    year: "1962",
    formula: "FV = EPS × (8.5 + 2g) × 4.4 / Y",
    howItWorks:
      "EPS dikali multiplier (8.5 + 2g) — 8.5 adalah base PE untuk zero-growth company, g adalah expected annual growth (%). Disesuaikan 4.4 / Y dimana Y adalah yield obligasi kualitas tinggi (kita pakai risk-free rate 5.75%). Semakin tinggi yield obligasi, semakin rendah fair value saham (saham harus kompetitif).",
    bestFor: [
      "Saham value dengan growth moderat (5-15%)",
      "Blue chip stabil",
      "Quick screening tool",
    ],
    limitations: [
      "Sensitif terhadap asumsi growth — pakai CAGR 5y di-cap 20%",
      "Gagal untuk perusahaan rugi",
      "Ketinggalan zaman untuk high-growth companies (cap 20% growth)",
    ],
    requires: ["EPS positif", "Historical EPS ≥ 2 tahun untuk growth"],
    sectorSuitability: {
      "Consumer Non-Cyclicals": "ideal",
      "Consumer Cyclicals": "works",
      "Healthcare": "works",
      "Industrials": "ideal",
      "Utilities": "ideal",
      "Infrastructures": "works",
      "Technology": "avoid",
      "Financials": "works",
      "Energy": "works",
      "Basic Materials": "works",
      "Properties & Real Estate": "works",
      "Transportation & Logistic": "works",
    },
    avoidReasons: {
      "Technology": "Growth tech sering >20% yang di-cap, dan mereka sering loss-making atau minimal earnings. Formula underestimate significantly.",
    },
  },

  EPV: {
    key: "EPV",
    label: "Earnings Power Value",
    tagline: "Nilai sustainable earnings power — tanpa asumsi growth spekulatif.",
    origin: "Bruce Greenwald — Columbia Business School. 'Value Investing: From Graham to Buffett and Beyond' (2001).",
    year: "2001",
    formula: "FV = (5y avg Net Profit / shares) / cost of equity",
    howItWorks:
      "Normalized earnings (rata-rata 5 tahun terakhir) dianggap representatif untuk kemampuan laba berkelanjutan. Dibagi cost of equity (13.75%) = nilai perpetuitas. Intinya: kalau sekarang beli saham ini dan dapat rata-rata laba historis selamanya, berapa worth-nya? Berbeda dengan DCF, EPV tidak memproyeksikan pertumbuhan — pertumbuhan dianggap 'gratis' yang bikin saham lebih worth kalau beneran terjadi.",
    bestFor: [
      "Perusahaan cyclical (earnings di-smooth lewat 5y avg)",
      "Bisnis mature tanpa growth prospects yang jelas",
      "Cross-check terhadap DCF (mana yang lebih konservatif)",
    ],
    limitations: [
      "Ignorant terhadap growth — understates high-growth companies significantly",
      "Membutuhkan track record minimal 5 tahun",
      "Gagal untuk perusahaan yang rata-rata 5y-nya rugi",
    ],
    requires: ["Net Profit history ≥ 2 tahun", "Rata-rata positif", "Jumlah saham"],
    sectorSuitability: {
      "Basic Materials": "ideal",
      "Energy": "ideal",
      "Industrials": "ideal",
      "Consumer Cyclicals": "ideal",
      "Transportation & Logistic": "ideal",
      "Consumer Non-Cyclicals": "works",
      "Utilities": "works",
      "Infrastructures": "works",
      "Financials": "works",
      "Healthcare": "works",
      "Technology": "avoid",
      "Properties & Real Estate": "works",
    },
    avoidReasons: {
      "Technology": "Tech growth tinggi dan terus kompon. EPV assume no growth = severely underestimate fair value.",
    },
  },

  DDM: {
    key: "DDM",
    label: "Dividend Discount Model (Gordon Growth)",
    tagline: "Saham = present value semua dividen masa depan.",
    origin: "Myron J. Gordon & Eli Shapiro (1956, formalisasi 1959).",
    year: "1959",
    formula: "FV = D₁ / (r − g)",
    howItWorks:
      "Dividen tahun depan (D₁ = DPS × (1+g)) dibagi selisih cost of equity (r = 13.75%) dan dividend growth rate (g = CAGR historis, capped r−2% untuk menghindari formula meledak). Konsep: semua return saham pada akhirnya datang dari dividen (langsung atau lewat capital appreciation yang refleksikan future dividen).",
    bestFor: [
      "Dividend aristocrats / payer konsisten",
      "Utilities, REITs, banks, telekomunikasi",
      "Perusahaan mature dengan payout ratio stabil",
    ],
    limitations: [
      "Hanya valid untuk saham yang bayar dividen",
      "Sangat sensitif ke (r−g) — kalau g mendekati r, fair value meledak",
      "Tidak cocok untuk perusahaan growth yang reinvest semua laba",
      "Dividen yang dibayar bisa jadi tidak sustainable (payout > 100%)",
    ],
    requires: ["Dividen positif terbayar di anchor year", "Dividen history ≥ 2 tahun", "Jumlah saham"],
    sectorSuitability: {
      "Utilities": "ideal",
      "Financials": "ideal",
      "Infrastructures": "ideal",
      "Properties & Real Estate": "ideal",
      "Consumer Non-Cyclicals": "ideal",
      "Energy": "works",
      "Healthcare": "works",
      "Industrials": "works",
      "Transportation & Logistic": "works",
      "Basic Materials": "works",
      "Consumer Cyclicals": "works",
      "Technology": "avoid",
    },
    avoidReasons: {
      "Technology": "Tech companies biasanya tidak bagi dividen (reinvest). DDM tidak applicable.",
    },
  },

  "Rel PER": {
    key: "Rel PER",
    label: "Relative PER",
    tagline: "Bandingkan PER saham dengan median peer di sektor yang sama.",
    origin: "Multiples-based valuation — banyak kontributor. Peter Lynch populerkan PEG di 'One Up on Wall Street' (1989).",
    year: "≥1960",
    formula: "FV = EPS × median PER sektor",
    howItWorks:
      "Median PER dari semua saham di sektor yang sama (di-trim: 0 < PER < 100) dianggap 'fair multiple'. Kalau EPS kita × median PER > harga sekarang, saham undervalued relatif ke peer. Metode ini market-relative — kalau seluruh sektor overvalued, metode ini tetap bilang 'fair'.",
    bestFor: [
      "Cross-sectional comparison dalam sektor yang sama",
      "Quick relative value check",
      "Sektor dengan banyak peer comparable",
    ],
    limitations: [
      "Garbage-in jika seluruh sektor mispriced",
      "Gagal untuk perusahaan rugi (PER negatif di-exclude)",
      "Kurang bermakna jika sektor punya segelintir saham (sample kecil)",
      "Tidak tangkap perbedaan kualitas di dalam sektor (EPS quality, leverage, dll)",
    ],
    requires: ["EPS positif", "Peer sektor ≥ 5 untuk median yang reliable"],
    sectorSuitability: {
      "Consumer Non-Cyclicals": "ideal",
      "Consumer Cyclicals": "ideal",
      "Industrials": "ideal",
      "Healthcare": "ideal",
      "Technology": "works",
      "Financials": "works",
      "Utilities": "works",
      "Infrastructures": "works",
      "Basic Materials": "works",
      "Transportation & Logistic": "works",
      "Properties & Real Estate": "works",
      "Energy": "avoid",
    },
    avoidReasons: {
      "Energy": "Sektor energi sangat cyclical — median PER pada peak cycle terlihat murah, pada bottom terlihat mahal. Pakai EV/EBIT atau EPV yang smoothing.",
    },
  },

  "Rel PBV": {
    key: "Rel PBV",
    label: "Relative PBV",
    tagline: "Bandingkan PBV saham dengan median peer di sektor yang sama.",
    origin: "Klasik Graham-Dodd, umum untuk valuasi bank & asset-heavy sejak 1930-an.",
    year: "≥1934",
    formula: "FV = BVPS × median PBV sektor",
    howItWorks:
      "Median PBV sektor (trim: 0 < PBV < 20) × BVPS perusahaan. Paling bermakna kalau book value mencerminkan nilai ekonomi aset — benar untuk bank (loan book), property (real estate), industrial (plant). Kurang berarti untuk service/tech dimana book value tidak tangkap brand, IP, human capital.",
    bestFor: [
      "Bank & asuransi (book value = loan book/investment portfolio)",
      "Perusahaan property & REITs",
      "Utilities & infrastructure (asset-heavy)",
      "Holding companies",
    ],
    limitations: [
      "Tidak cocok untuk intangible-heavy (tech, farmasi, consumer brand)",
      "Gagal untuk perusahaan dengan book value negatif",
      "Bisa misleading saat ada write-down / write-up besar",
    ],
    requires: ["BVPS positif", "Peer sektor ≥ 5"],
    sectorSuitability: {
      "Financials": "ideal",
      "Properties & Real Estate": "ideal",
      "Utilities": "ideal",
      "Basic Materials": "ideal",
      "Industrials": "works",
      "Infrastructures": "ideal",
      "Energy": "works",
      "Transportation & Logistic": "works",
      "Consumer Cyclicals": "works",
      "Consumer Non-Cyclicals": "works",
      "Healthcare": "works",
      "Technology": "avoid",
    },
    avoidReasons: {
      "Technology": "Tech value sebagian besar di intangibles (code, platform, network effect). Book value tidak capture itu — PBV terlihat tinggi padahal saham mungkin wajar.",
    },
  },

  "EV/EBIT": {
    key: "EV/EBIT",
    label: "EV/EBIT (Enterprise Value / Operating Profit)",
    tagline: "Valuasi bebas-struktur-modal — bandingkan seluruh perusahaan, bukan equity saja.",
    origin: "Joel Greenblatt — 'The Little Book That Beats the Market' (2005). Bagian dari Magic Formula.",
    year: "2005",
    formula: "FV/share = (EBIT × median EV/EBIT sektor − net debt) / shares",
    howItWorks:
      "Enterprise Value = equity value + debt − cash = nilai seluruh perusahaan terlepas dari siapa yang membiayai. EBIT adalah laba operasi (sebelum bunga, pajak) — apples-to-apples antar perusahaan dengan struktur modal beda. Median EV/EBIT sektor × EBIT perusahaan = enterprise value wajar, dikurangi net debt = equity value. Sangat baik untuk compare perusahaan dengan leverage berbeda.",
    bestFor: [
      "Perusahaan dengan struktur modal berbeda-beda dalam satu sektor",
      "Industrials, manufacturing, consumer",
      "Cyclical (karena EBIT lebih stabil dari Net Profit yang kena interest)",
      "Magic Formula screening",
    ],
    limitations: [
      "Tidak applicable untuk bank/asuransi (EBIT tidak relevan, 'debt' adalah produk inti mereka)",
      "Tidak cocok untuk perusahaan early-stage tanpa EBIT positif",
      "Net debt perlu angka yang reliable",
    ],
    requires: ["EBIT positif", "Enterprise Value", "Net Debt data"],
    sectorSuitability: {
      "Industrials": "ideal",
      "Consumer Cyclicals": "ideal",
      "Consumer Non-Cyclicals": "ideal",
      "Energy": "ideal",
      "Basic Materials": "ideal",
      "Transportation & Logistic": "ideal",
      "Healthcare": "works",
      "Utilities": "works",
      "Infrastructures": "works",
      "Technology": "works",
      "Properties & Real Estate": "works",
      "Financials": "avoid",
    },
    avoidReasons: {
      "Financials": "Bank & asuransi tidak punya 'EBIT' dalam arti normal — interest expense adalah COGS mereka. Rasio EV/EBIT tidak meaningful untuk financial services.",
    },
  },

  NAV: {
    key: "NAV",
    label: "Net Asset Value (Book)",
    tagline: "Nilai liquidation per saham — seberapa 'asset-backed' saham ini.",
    origin: "Tradisional accounting-based. Umum di investment trust & holding companies sejak 1920-an.",
    year: "≥1920",
    formula: "FV = BVPS (Book Value per Share)",
    howItWorks:
      "Nilai buku bersih per saham dari neraca (ekuitas / jumlah saham). Kalau saham dibawah NAV, diasumsikan ada 'margin of safety' — in theory, jika perusahaan dilikuidasi hari ini, pemegang saham dapat NAV. Dalam praktik, nilai buku historical cost bisa jauh dari nilai pasar aset (bisa lebih rendah untuk property apresiasi, lebih tinggi untuk intangibles).",
    bestFor: [
      "REITs & property — nilai utama memang real estate",
      "Holding companies / investment trusts",
      "Saham dalam distress (liquidation value floor)",
      "Bank dalam kondisi normal",
    ],
    limitations: [
      "Book value biasanya < nilai pasar aset real (conservative)",
      "Tidak relevan untuk perusahaan yang nilainya di future earnings (tech, farmasi)",
      "Goodwill di neraca bisa menipu (belum tentu real economic value)",
    ],
    requires: ["BVPS positif dari neraca"],
    sectorSuitability: {
      "Properties & Real Estate": "ideal",
      "Financials": "ideal",
      "Utilities": "works",
      "Infrastructures": "works",
      "Industrials": "works",
      "Basic Materials": "works",
      "Energy": "works",
      "Transportation & Logistic": "works",
      "Consumer Cyclicals": "works",
      "Consumer Non-Cyclicals": "works",
      "Healthcare": "works",
      "Technology": "avoid",
    },
    avoidReasons: {
      "Technology": "Perusahaan tech: nilai di software, brand, network effect — bukan di neraca. NAV akan selalu terlihat sangat rendah → misleading 'undervaluation'.",
    },
  },

  PEG: {
    key: "PEG",
    label: "PEG / Peter Lynch",
    tagline: "Fair PER ≈ growth rate (%). Simple rule untuk growth stocks.",
    origin: "Peter Lynch — 'One Up on Wall Street' (1989). Dikembangkan lewat pengalamannya di Fidelity Magellan Fund.",
    year: "1989",
    formula: "FV = EPS × growth% (capped 5-25)",
    howItWorks:
      "Peter Lynch bilang 'the P/E of any company that's fairly priced will equal its growth rate'. Kalau EPS growth 15% per tahun, fair PER = 15x. Kami cap growth di range 5-25% untuk menghindari hasil ekstrem — growth <5% tidak realistis untuk jangka panjang (inflasi ≈ 3%), >25% tidak sustainable.",
    bestFor: [
      "Growth stocks dengan EPS growth konsisten",
      "Quality compounders",
      "Quick screening untuk investor retail",
    ],
    limitations: [
      "Gagal untuk perusahaan rugi atau EPS turun (growth negatif → null)",
      "Growth historis bukan jaminan future growth",
      "Tidak perhitungkan cost of equity / risk",
      "Tidak applicable untuk cyclical (growth bounces)",
    ],
    requires: ["EPS positif", "EPS growth ≥ 2 tahun data"],
    sectorSuitability: {
      "Consumer Non-Cyclicals": "ideal",
      "Healthcare": "ideal",
      "Technology": "ideal",
      "Consumer Cyclicals": "works",
      "Industrials": "works",
      "Financials": "works",
      "Utilities": "works",
      "Infrastructures": "works",
      "Energy": "avoid",
      "Basic Materials": "avoid",
      "Properties & Real Estate": "works",
      "Transportation & Logistic": "works",
    },
    avoidReasons: {
      "Energy": "Commodity cyclicals — EPS growth sangat variabel, PEG salah arah pada peak/trough cycle.",
      "Basic Materials": "Sama seperti Energy — cyclical.",
    },
  },

  RIM: {
    key: "RIM",
    label: "Residual Income Model",
    tagline: "BVPS + PV dari excess earnings (ROE di atas cost of equity).",
    origin: "Edwards-Bell-Ohlson framework (1995). Populer di academic valuation untuk bank.",
    year: "1995",
    formula: "FV = BVPS + Σ (ROE − r) × BVPS / (1+r)^t, fade 5y",
    howItWorks:
      "Book value per share sebagai baseline, ditambah present value dari 'excess earnings' — keuntungan di atas cost of equity (ROE − 13.75%). Excess di-decay linear selama 5 tahun (asumsi competition akan erode keuntungan abnormal). Jika ROE ≤ cost of equity, fair value = BVPS saja (tidak ada excess return). Sangat cocok untuk bisnis book-heavy dimana BVPS reliable.",
    bestFor: [
      "Bank & asuransi (BV adalah loan/investment book yang real)",
      "Holding companies",
      "Utility dengan asset base jelas",
      "Cross-check terhadap Rel PBV",
    ],
    limitations: [
      "ROE negatif atau BVPS negatif → gagal",
      "Asumsi excess fading linear bisa terlalu agresif atau konservatif",
      "Tidak perhitungkan reinvestment / growth eksplisit",
      "Book value tech/intangible companies tidak reliable",
    ],
    requires: ["BVPS positif", "ROE data di anchor year"],
    sectorSuitability: {
      "Financials": "ideal",
      "Properties & Real Estate": "ideal",
      "Utilities": "ideal",
      "Infrastructures": "ideal",
      "Industrials": "works",
      "Consumer Non-Cyclicals": "works",
      "Consumer Cyclicals": "works",
      "Healthcare": "works",
      "Basic Materials": "works",
      "Energy": "works",
      "Transportation & Logistic": "works",
      "Technology": "avoid",
    },
    avoidReasons: {
      "Technology": "Tech value di intangibles, bukan book. RIM akan understate karena BVPS underrepresents true assets.",
    },
  },

  "FCF Power": {
    key: "FCF Power",
    label: "FCF Power Value",
    tagline: "5y avg Free Cash Flow / cost of equity. EPV versi cash flow.",
    origin: "Cash-flow variant dari Greenwald EPV framework.",
    year: "~2000s",
    formula: "FV = (5y avg FCF / shares) / cost of equity",
    howItWorks:
      "Seperti EPV tapi pakai Free Cash Flow (bukan Net Profit). Rationale: FCF lebih sulit dimanipulasi dan menunjukkan cash-generating quality yang real. Rata-rata 5 tahun untuk smoothing capex lumpy, lalu di-capitalize di cost of equity (13.75%) — analog perpetuity. Fair value konservatif karena tidak asumsi growth.",
    bestFor: [
      "Cash cows mature (consumer, utility)",
      "Perusahaan dengan capex yang relatif stabil",
      "Cross-check DCF yang mungkin terlalu optimistic",
    ],
    limitations: [
      "Gagal jika 5y avg FCF negatif (growth stocks investing heavily)",
      "Ignorant terhadap growth — underestimate compounders",
      "Butuh track record FCF minimal 3-5 tahun",
    ],
    requires: ["FCF history ≥ 2 tahun dengan rata-rata positif", "Jumlah saham"],
    sectorSuitability: {
      "Consumer Non-Cyclicals": "ideal",
      "Utilities": "ideal",
      "Healthcare": "ideal",
      "Industrials": "ideal",
      "Consumer Cyclicals": "works",
      "Infrastructures": "works",
      "Transportation & Logistic": "works",
      "Energy": "works",
      "Basic Materials": "works",
      "Technology": "works",
      "Financials": "avoid",
      "Properties & Real Estate": "avoid",
    },
    avoidReasons: {
      "Financials": "Bank cash flow didominasi pendanaan, bukan operasi. FCF konsep tidak reliable.",
      "Properties & Real Estate": "Nilai di aset, bukan FCF operasi yang sering lumpy.",
    },
  },

  "Rel PS": {
    key: "Rel PS",
    label: "Relative Price / Sales",
    tagline: "Rev/share × median P/S sektor. Baik untuk loss-makers.",
    origin: "Kenneth Fisher — 'Super Stocks' (1984). Populer untuk early-stage / cyclical.",
    year: "1984",
    formula: "FV = (Revenue / shares) × median P/S sektor",
    howItWorks:
      "P/S ratio adalah multiple yang paling sulit dimanipulasi karena revenue umumnya clean (earnings bisa di-massage). Median P/S sektor × revenue per share = fair value. Kuat untuk perusahaan loss-making (PER gagal) atau cyclical (PER misleading pada trough). Lemah: tidak perhitungkan margin — perusahaan dengan margin 20% dan 5% akan dinilai sama.",
    bestFor: [
      "Perusahaan rugi atau earnings nol",
      "Cyclical dalam trough",
      "Early-stage growth companies",
      "Cross-check terhadap PER untuk sanity",
    ],
    limitations: [
      "Ignorant terhadap margin quality (low margin = overvalued at same P/S)",
      "Tidak perhitungkan struktur modal",
      "Sektor dengan sample kecil → median unreliable",
    ],
    requires: ["Revenue positif", "Jumlah saham", "Peer sektor ≥ 5"],
    sectorSuitability: {
      "Consumer Cyclicals": "ideal",
      "Technology": "ideal",
      "Healthcare": "ideal",
      "Consumer Non-Cyclicals": "works",
      "Industrials": "works",
      "Energy": "ideal",
      "Basic Materials": "ideal",
      "Transportation & Logistic": "works",
      "Utilities": "works",
      "Infrastructures": "works",
      "Properties & Real Estate": "works",
      "Financials": "avoid",
    },
    avoidReasons: {
      "Financials": "Bank 'revenue' adalah interest income — P/S bukan metrik yang meaningful. Pakai Rel PBV atau DDM.",
    },
  },
};

export const METHOD_ORDER = [
  "DCF",
  "Graham",
  "Graham Revised",
  "EPV",
  "DDM",
  "Rel PER",
  "Rel PBV",
  "EV/EBIT",
  "NAV",
  "PEG",
  "RIM",
  "FCF Power",
  "Rel PS",
];

/**
 * Return suitability for (method, sector) with default "works" if unspecified.
 */
export function getSuitability(
  methodKey: string,
  sector: string | null,
): Suitability {
  if (!sector) return "works";
  const info = METHOD_INFO[methodKey];
  if (!info) return "works";
  return info.sectorSuitability[sector] ?? "works";
}

export function getAvoidReason(
  methodKey: string,
  sector: string | null,
): string | null {
  if (!sector) return null;
  const info = METHOD_INFO[methodKey];
  if (!info) return null;
  return info.avoidReasons[sector] ?? null;
}

export function suitabilityBadgeClass(s: Suitability): string {
  if (s === "ideal") return "bg-emerald-500/80 text-white";
  if (s === "works") return "bg-muted text-muted-foreground";
  return "bg-rose-500/80 text-white";
}

export function suitabilityLabel(s: Suitability): string {
  if (s === "ideal") return "Ideal";
  if (s === "works") return "Berlaku";
  return "Kurang cocok";
}
