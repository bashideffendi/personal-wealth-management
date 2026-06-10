import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { consumeAICredits, refundAICredits } from '@/lib/ai-credits'
import { rateLimit } from '@/lib/rate-limit'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  SAVING_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Bulk import dari mutasi rekening — PDF atau text yang user paste.
 *
 * Tantangan utama bukan parsing (Claude oke-oke aja), tapi:
 *   1. Banyak bank format beda — pakai prompting yang descriptive, biar
 *      AI generalize dari context ketimbang regex per-bank.
 *   2. Jangan halusinasi transaksi yang gak ada. Strict instruction:
 *      "kalau ragu, skip baris itu, lebih baik kelewat daripada palsu".
 *   3. Sign convention beda: ada bank pakai - utk debit, ada yg pisah
 *      column DEBET/KREDIT. Kita normalisasi ke `type` enum + positive amount.
 *
 * Output: array transaksi yang sudah cleaned + dikategorikan. Frontend
 * masih perlu user confirm sebelum bulk insert ke DB (dedupe + edit).
 */

const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...SAVING_CATEGORIES,
  ...INVESTMENT_CATEGORIES,
] as const

const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_TEXT_LEN = 100_000  // ~25k tokens

const SYSTEM_PROMPT = `Kamu adalah asisten ekstraksi mutasi rekening bank Indonesia. Tugasmu mengubah mutasi (PDF atau text) jadi array transaksi terstruktur.

Aturan EKSTRAKSI:
- Setiap baris transaksi → satu entry di output
- "date" format YYYY-MM-DD. Bank pakai DD/MM/YYYY atau DD-MM-YYYY → konversi.
- "amount" SELALU positif (integer rupiah, tanpa desimal/separator). Sign dibawa di field "type".
- "type" = "expense" untuk debit/keluar/kurang, "income" untuk kredit/masuk/tambah.
- "description" = ringkasan tanggal+merchant+memo. Hilangkan kode internal bank (NOMOR REK, BATCH, dll) — keep info yang berguna buat user.
- "category" = pilih SATU dari daftar. Pakai konteks merchant/memo:
  * Indomaret/Alfamart/restaurant → "Makanan"
  * Gojek/Grab/MyBlueBird/SPBU → "Transportasi"
  * Tokopedia/Shopee → "Pakaian & Aksesoris" (default) atau "Makanan" kalau jelas groceries
  * PLN/PDAM/Telkom/Indihome → "Tagihan"
  * Netflix/Spotify/Apple → "Langganan"
  * Apotek/RS/klinik → "Kesehatan"
  * Sekolah/kursus → "Pendidikan"
  * Booking hotel/tiket → "Perjalanan"
  * Bioskop/game → "Hiburan"
  * Transfer dari/ke akun sendiri → SKIP transaksi ini (jangan keluarkan, mark via flag)
  * Gaji/payroll → "Gaji"
  * Tunai/ATM withdrawal → "Lainnya"
- "confidence" = "high" (yakin merchant + kategori), "medium" (kategori menebak dari konteks tipis), "low" (deskripsi ambigu)

LARANGAN:
- JANGAN halusinasi transaksi. Kalau baris gak jelas (header, footer, saldo awal/akhir, summary) → skip.
- JANGAN modifikasi amount. Kalau gak yakin angkanya, skip baris.
- JANGAN merger dua baris jadi satu kalau emang dua transaksi terpisah.

Output: panggil tool import_transactions dengan array. Kalau zero transaksi valid, return array kosong.`

const RESPONSE_SCHEMA: Anthropic.Tool.InputSchema = {
  type: 'object',
  properties: {
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          description: { type: 'string' },
          amount: { type: 'integer', minimum: 1 },
          type: { type: 'string', enum: ['expense', 'income'] },
          category: { type: 'string', enum: ALL_CATEGORIES as unknown as string[] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          is_transfer: {
            type: 'boolean',
            description: 'true kalau ini transfer ke/dari akun sendiri (sebaiknya skip di import)',
          },
        },
        required: ['date', 'description', 'amount', 'type', 'category', 'confidence', 'is_transfer'],
        additionalProperties: false,
      },
    },
    bank_name: {
      type: 'string',
      description: 'Nama bank yang terdeteksi dari mutasi (opsional)',
    },
    period_start: {
      type: 'string',
      description: 'Tanggal mulai periode mutasi (YYYY-MM-DD), opsional',
    },
    period_end: {
      type: 'string',
      description: 'Tanggal akhir periode mutasi (YYYY-MM-DD), opsional',
    },
  },
  required: ['transactions'],
  additionalProperties: false,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Burst guard (AI abuse) — per-user; see src/lib/rate-limit.ts
  const rl = rateLimit(`ai:${user.id}`)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan AI. Coba lagi dalam ${rl.retryAfterSec} detik.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY tidak terkonfigurasi di server' },
      { status: 500 },
    )
  }

  // Charge credits up-front. Bulk import = 5 credits (vs 1 for single receipt).
  // We could meter per-token but flat fee keeps the UX predictable.
  const credit = await consumeAICredits(supabase, user.id, 'mutasi_import')
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error }, { status: credit.status })
  }

  const contentType = request.headers.get('content-type') ?? ''

  let content: Anthropic.ContentBlockParam[]

  // ─── Branch 1: PDF upload via multipart ──────────────────────────
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      await refundAICredits(supabase, user.id, 'mutasi_import')
      return NextResponse.json({ error: 'Body multipart invalid' }, { status: 400 })
    }
    const file = formData.get('pdf')
    if (!(file instanceof File)) {
      await refundAICredits(supabase, user.id, 'mutasi_import')
      return NextResponse.json({ error: 'Field "pdf" wajib (file)' }, { status: 400 })
    }
    if (file.size > MAX_PDF_BYTES) {
      await refundAICredits(supabase, user.id, 'mutasi_import')
      return NextResponse.json(
        { error: `PDF terlalu besar (${Math.round(file.size / 1024 / 1024)}MB). Maks 10MB.` },
        { status: 400 },
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    // Simple PDF signature check — first 5 bytes should be "%PDF-"
    if (buf.length < 5 || buf.slice(0, 5).toString() !== '%PDF-') {
      await refundAICredits(supabase, user.id, 'mutasi_import')
      return NextResponse.json(
        { error: 'File bukan PDF valid (signature header gak cocok).' },
        { status: 400 },
      )
    }

    content = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: buf.toString('base64'),
        },
      },
      {
        type: 'text',
        text: 'Ekstrak semua transaksi dari mutasi rekening ini dengan tool import_transactions.',
      },
    ]
  }
  // ─── Branch 2: Pasted text via JSON ───────────────────────────────
  else {
    let body: { text?: string } = {}
    try {
      body = await request.json()
    } catch {
      await refundAICredits(supabase, user.id, 'mutasi_import')
      return NextResponse.json({ error: 'Body JSON invalid' }, { status: 400 })
    }
    const text = (body.text ?? '').trim()
    if (!text) {
      await refundAICredits(supabase, user.id, 'mutasi_import')
      return NextResponse.json({ error: 'Field "text" wajib diisi' }, { status: 400 })
    }
    if (text.length > MAX_TEXT_LEN) {
      await refundAICredits(supabase, user.id, 'mutasi_import')
      return NextResponse.json(
        { error: `Text terlalu panjang (${text.length} chars). Maks ${MAX_TEXT_LEN}.` },
        { status: 400 },
      )
    }
    content = [
      {
        type: 'text',
        text: `Ekstrak semua transaksi dari mutasi berikut, panggil tool import_transactions:\n\n${text}`,
      },
    ]
  }

  const client = new Anthropic()

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'import_transactions',
          description:
            'Output array transaksi terstruktur hasil ekstraksi dari mutasi rekening.',
          input_schema: RESPONSE_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'import_transactions' },
      messages: [{ role: 'user', content }],
    })

    if (response.stop_reason === 'refusal') {
      await refundAICredits(supabase, user.id, 'mutasi_import')
      return NextResponse.json(
        { error: 'Claude menolak memproses dokumen ini.' },
        { status: 422 },
      )
    }

    const toolUseBlock = response.content.find((b) => b.type === 'tool_use')
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      await refundAICredits(supabase, user.id, 'mutasi_import')
      return NextResponse.json(
        { error: 'Claude tidak memanggil tool import_transactions' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      data: toolUseBlock.input,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    })
  } catch (err) {
    await refundAICredits(supabase, user.id, 'mutasi_import')
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${err.message}`, status: err.status },
        { status: 502 },
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
