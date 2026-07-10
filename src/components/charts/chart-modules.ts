/**
 * SATU pintu dynamic-import untuk SEMUA komponen chart berbasis recharts.
 *
 * Kenapa: tiap boundary `dynamic(() => import('./x-charts'))` yang menunjuk
 * modul BERBEDA membuat Turbopack menyalin recharts utuh (±304KB raw / 87KB
 * gzip) ke chunk masing-masing — terukur 9 salinan identik ≈ 40% seluruh
 * client JS. Dengan semua boundary menunjuk modul yang SAMA ini, recharts
 * jatuh di satu chunk bersama yang di-download sekali.
 *
 * Aturan: komponen chart recharts baru WAJIB di-re-export dari sini, dan
 * pemakainya wajib `dynamic(() => import('@/components/charts/chart-modules')
 * .then((m) => m.NamaChart), { ssr: false })` — JANGAN import modul leaf-nya
 * langsung di boundary dynamic baru.
 *
 * Biaya sadar: membuka satu chart ikut memuat kode komponen chart lain
 * (kecil, beberapa KB per leaf) — jauh lebih murah daripada re-download
 * recharts per permukaan. monthly-report-body TIDAK lewat sini (recharts-nya
 * inline di body laporan — kandidat ekstraksi fase berikutnya).
 */

export { AllocationPie, NonLiquidBar } from '@/app/dashboard/assets/assets-charts'
export { CategoryBarChart } from '@/app/dashboard/category/[name]/category-chart'
export { ProjectionChart, HistoryChart } from '@/app/dashboard/net-worth/net-worth-charts'
export { MonthlyFlowChart, InvestmentPie } from '@/components/dashboard/dashboard-charts'
export { MoneyFlowSankey } from '@/components/dashboard/money-flow-sankey'
export { DividendsPanel } from '@/components/investment/dividends-panel'
export { EquityArea, AllocationDonut, DividendBar } from '@/components/investment/investment-charts'
export { MetricLineChart } from '@/components/investment/metric-line-chart'
export { StockPriceChart } from '@/components/investment/stock-price-chart'
export { ValuationBars } from '@/components/investment/valuation-bars'
