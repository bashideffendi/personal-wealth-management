import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  SAVING_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 30

const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...SAVING_CATEGORIES,
  ...INVESTMENT_CATEGORIES,
] as const

const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

const SYSTEM_PROMPT = `Kamu adalah asisten OCR struk belanja Indonesia. Tugasmu mengekstrak field-field penting dari foto struk.

Aturan:
- Bahasa struk: Indonesia (kadang campur Inggris)
- Mata uang: Rupiah (IDR). Kembalikan amount sebagai integer rupiah TANPA desimal/separator (contoh: "Rp 25.500" → 25500)
- "merchant" = nama toko/restoran/penyedia jasa (bukan nama kasir/cabang)
- "date" = tanggal transaksi format YYYY-MM-DD. Kalau struk pakai DD/MM/YYYY atau DD-MM-YYYY, konversi
- "total" = nominal yang DIBAYAR pelanggan (setelah diskon, pajak, service charge — biasanya paling bawah, label "TOTAL"/"GRAND TOTAL"/"TOTAL BAYAR")
- "type" = selalu "expense" untuk struk belanja
- "category" = pilih SATU kategori paling cocok dari daftar yang dikasih (contoh: Indomaret/Alfamart → "Makanan", Gojek/Grab → "Transportasi", PLN/PDAM → "Tagihan", Netflix/Spotify → "Langganan")
- "description" = nama merchant + ringkasan singkat (contoh: "Indomaret - belanja groceries")
- "confidence" = "high" (struk jelas), "medium" (sebagian buram/ambigu), "low" (sangat sulit dibaca)

Kalau ada field yang ga bisa dibaca dengan yakin, isi dengan nilai default yang masuk akal dan turunkan confidence-nya. JANGAN halusinasi nominal.`

const RESPONSE_SCHEMA: Anthropic.Tool.InputSchema = {
  type: 'object',
  properties: {
    merchant: {
      type: 'string',
      description: 'Nama toko/penyedia jasa',
    },
    date: {
      type: 'string',
      description: 'Tanggal transaksi format YYYY-MM-DD',
    },
    total: {
      type: 'integer',
      description: 'Total dibayar dalam rupiah (integer, tanpa desimal/separator)',
      minimum: 0,
    },
    type: {
      type: 'string',
      enum: ['expense', 'income', 'saving', 'investment'],
    },
    category: {
      type: 'string',
      enum: ALL_CATEGORIES as unknown as string[],
      description: 'Kategori transaksi (pilih satu dari enum)',
    },
    description: {
      type: 'string',
      description: 'Deskripsi singkat transaksi',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
    },
    notes: {
      type: 'string',
      description: 'Catatan tambahan (opsional, untuk hal yang ga yakin)',
    },
  },
  required: ['merchant', 'date', 'total', 'type', 'category', 'description', 'confidence'],
  additionalProperties: false,
}

export async function POST(request: NextRequest) {
  // Auth gate
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY tidak terkonfigurasi di server' },
      { status: 500 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Body harus multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Field "image" wajib (file)' }, { status: 400 })
  }

  if (!ALLOWED_MEDIA.has(file.type)) {
    return NextResponse.json(
      { error: `Tipe file tidak didukung: ${file.type}. Pakai JPEG/PNG/WebP/GIF.` },
      { status: 400 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File terlalu besar (${Math.round(file.size / 1024 / 1024)}MB). Maks 10MB.` },
      { status: 400 },
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const client = new Anthropic()

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'extract_receipt',
          description:
            'Ekstrak data terstruktur dari foto struk belanja Indonesia. Selalu panggil tool ini sebagai output.',
          input_schema: RESPONSE_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_receipt' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Ekstrak field-field dari struk ini dengan memanggil tool extract_receipt.',
            },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'Claude menolak memproses gambar ini.' },
        { status: 422 },
      )
    }

    const toolUseBlock = response.content.find((b) => b.type === 'tool_use')
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      return NextResponse.json(
        { error: 'Claude tidak memanggil tool extract_receipt' },
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
