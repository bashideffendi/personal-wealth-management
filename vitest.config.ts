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
  },
})
