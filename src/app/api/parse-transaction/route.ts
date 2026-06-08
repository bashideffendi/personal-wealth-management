import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  SAVING_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 15

const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...SAVING_CATEGORIES,
  ...INVESTMENT_CATEGORIES,
] as const

const SYSTEM_PROMPT = `Kamu adalah parser teks transaksi keuangan Indonesia. User mengetik dengan bahasa natural seperti:
- "indomaret 47rb"
- "makan padang 35000 cash"
- "gaji bulan ini 8jt"
- "bayar netflix 99000"
- "transfer ke ortu 500rb"

Tugasmu ekstrak field transaksi dari teks tsb.

Aturan:
- "type" wajib salah satu: "income" | "expense" | "saving" | "investment"
- Default ke "expense" kalau ga jelas. "Gaji/bonus/dividen/THR/refund" → income.
- "Tabungan/menabung" → saving. "Beli saham/crypto/reksadana" → investment.
- "amount" dalam INTEGER rupiah (tanpa desimal). Convert "rb"/"ribu"→×1000, "jt"/"juta"→×1000000, "k"→×1000.
- "category" pilih dari enum yang dikasih. Tebakan terbaik dari merchant/konteks:
  - "indomaret/alfamart/superindo" → "Makanan"
  - "gojek/grab" → "Transportasi"
  - "netflix/spotify/youtube premium" → "Langganan"
  - "PLN/PDAM/internet" → "Tagihan"
  - "gaji" → "Gaji"
- "description" = ringkasan singkat transaksi natural
- "payment_hint" = string opsional kalau user sebut method (cash/qris/bca/gopay/dll), kosong kalau ga ada
- "confidence" = "high" / "medium" / "low" — seberapa yakin parse-nya benar`

export async function POST(request: NextRequest) {
  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      { error: 'ANTHROPIC_API_KEY tidak terkonfigurasi' },
      { status: 500 },
    )
  }

  // Logging a transaction (NL/voice quick-add) is UNLIMITED & free — frequency
  // of logging is the #1 retention signal, so we never charge credits for it.
  // The per-user burst guard above is the only throttle.

  let body: { text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text || text.length < 3) {
    return NextResponse.json({ error: 'Text terlalu pendek' }, { status: 400 })
  }

  const SCHEMA: Anthropic.Tool.InputSchema = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['income', 'expense', 'saving', 'investment'],
      },
      amount: {
        type: 'integer',
        minimum: 0,
        description: 'Jumlah dalam rupiah, integer tanpa desimal',
      },
      category: {
        type: 'string',
        enum: ALL_CATEGORIES as unknown as string[],
      },
      description: {
        type: 'string',
        description: 'Deskripsi singkat transaksi',
      },
      payment_hint: {
        type: 'string',
        description: 'Hint cara bayar (cash/qris/bca/gopay) — kosongkan jika tidak ada',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
      },
    },
    required: ['type', 'amount', 'category', 'description', 'confidence'],
    additionalProperties: false,
  }

  const client = new Anthropic()

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'parse_transaction',
          description: 'Ekstrak data transaksi dari teks natural',
          input_schema: SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'parse_transaction' },
      messages: [
        {
          role: 'user',
          content: `Parse teks ini: "${text}"`,
        },
      ],
    })

    const block = response.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      return NextResponse.json(
        { error: 'Claude tidak memanggil parser' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      data: block.input,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    })
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${err.message}` },
        { status: 502 },
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
