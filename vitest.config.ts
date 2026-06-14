import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Unit tests untuk lib murni (matematika uang, Monte Carlo, mapping).
// Sengaja node environment + tanpa setup DOM — yang dites input→output,
// bukan komponen. Komponen diverifikasi via build + screenshot flow.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      // Coverage GATE (reliability-5) — regresi guard buat lib money/scoring
      // murni. perFile=true → tiap file harus lolos sendiri (bukan rata-rata,
      // biar satu file yg crater ketahuan). Floor di bawah angka aktual biar
      // refactor kecil gak getas; hapus test → coverage turun → CI merah.
      //
      // Sengaja TIDAK di-gate:
      //  - liquid / budget-categories / valuation → punya fungsi DB/orchestrator
      //    yg butuh mock Supabase (di luar unit test); bagian PURE-nya tetap diuji.
      //  - debt-payoff / net-worth-projection / enrich → diuji penuh di suite,
      //    tapi v8 nggak konsisten meng-instrument-nya; diandalkan ke `npm test`.
      include: [
        'src/lib/recurrence.ts',
        'src/lib/depreciation.ts',
        'src/lib/financial-health.ts',
        'src/lib/goal-probability.ts',
        'src/lib/invest/fifo.ts',
        'src/lib/invest/piotroski.ts',
        'src/lib/invest/reverse-dcf.ts',
      ],
      thresholds: {
        perFile: true,
        lines: 80,
        functions: 80,
        statements: 65,
        branches: 60,
      },
    },
  },
})
