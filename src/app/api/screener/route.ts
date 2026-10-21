import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { ScreenerResponse } from '@/lib/invest/screener'

/**
 * Screener IDX v2 — sajikan src/data/invest/screener-v2.json apa adanya
 * (meta + baris). Berkas diekspor bulanan dari IDX Screener: data pasar
 * semua emiten + skor riset/nilai wajar residual income untuk semesta
 * berskor. Nilai wajar konsensus Excel dan verdict lama sudah dihapus.
 *
 * Dibaca sekali per instance lalu di-cache module-level; rebuild kalau
 * mtime berubah (deploy data baru).
 *
 * NOTE: route ini WAJIB terdaftar di outputFileTracingIncludes
 * (next.config.ts) — fs-read dinamis gak kelihatan sama tracer Next.
 */
export const runtime = 'nodejs'

const SRC = path.join(process.cwd(), 'src', 'data', 'invest', 'screener-v2.json')

let cache: { body: ScreenerResponse; srcMtime: number } | null = null

function load(): ScreenerResponse {
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf-8')) as ScreenerResponse['meta'] & {
    rows: ScreenerResponse['rows']
  }
  const { rows, ...meta } = raw
  return { meta, rows }
}

export async function GET() {
  let srcMtime = 0
  try {
    srcMtime = fs.statSync(SRC).mtimeMs
  } catch {
    // stat gagal → pakai cache yang ada kalau ada
  }

  try {
    if (!cache || cache.srcMtime !== srcMtime) cache = { body: load(), srcMtime }
  } catch {
    // baca/parse gagal → tetap layani cache lama kalau ada
  }
  if (!cache) return NextResponse.json({ error: 'Data screener tidak tersedia' }, { status: 500 })

  return NextResponse.json(cache.body, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
