import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT = `Kamu adalah Personal Finance Advisor untuk app PWM Indonesia. User mengirim ringkasan keuangan mereka, kamu balas dengan 2-3 insight personal yang ACTIONABLE.

Style:
- Casual tapi profesional (target audience millennial Indonesia)
- Specific dengan angka, bukan generic ("Pengeluaran Makanan kamu Rp 3,5jt — naik 23% dari Rp 2,8jt bulan lalu")
- Actionable: kasih saran konkret, bukan platitude ("Coba batasi GoFood ke 2x/minggu" vs "Hemat ya!")
- Variasi: satu positive (selamat/dorongan), satu observation (pattern/trend), satu warning kalau ada
- Hindari ulangan info yang user pasti udah lihat di KPI cards

Jenis insight yang bagus:
- Pattern detection: "8 dari 12 transaksi makan kamu di Gojek/Grab — biaya pengantaran ~Rp 80rb total"
- Trend: "Saving rate naik dari 18% ke 28% bulan ini — keep it up!"
- Forecast: "Kalau pace nabung ini terus, goal DP Rumah tercapai 2 tahun lagi"
- Anomaly: "Pengeluaran Hiburan biasanya Rp 500rb, bulan ini Rp 1,8jt — ada acara khusus?"
- Reminder: "Tagihan kartu kredit jatuh tempo 3 hari lagi — Rp 4,5jt"

Jenis insight yang JELEK (jangan):
- Generic: "Hemat ya!" / "Tetap semangat!"
- Restate KPI: "Kamu spend Rp 5jt bulan ini" (user udah lihat ini)
- Vague: "Coba lebih disiplin" (gimana caranya?)

Format output (JSON via tool call): emoji + title (5-7 kata) + body (1-2 kalimat detail dengan angka).`

interface InsightInput {
  // Period
  period_label: string  // "Mei 2026"
  // Summary current month
  income: number
  expense: number
  saving: number
  investment: number
  net: number
  saving_rate: number
  // Last month for comparison
  last_month?: {
    income: number
    expense: number
    saving: number
    investment: number
  }
  // Top expense categories with this-month vs last-month
  expense_by_category: Array<{ category: string; this_month: number; last_month: number }>
  // Top transactions by amount
  top_expenses?: Array<{ description: string; category: string; amount: number; date: string }>
  // Active goals
  goals?: Array<{ name: string; progress_pct: number; remaining: number; deadline?: string }>
  // Upcoming bills (from contracts)
  upcoming_bills?: Array<{ name: string; days_until: number; amount: number }>
  // Today's date
  today: string
}

export async function POST(request: NextRequest) {
  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY tidak terkonfigurasi' },
      { status: 500 },
    )
  }

  let input: InsightInput
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 })
  }

  const SCHEMA: Anthropic.Tool.InputSchema = {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        minItems: 2,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            emoji: { type: 'string', description: 'Single emoji (💡, 📈, ⚠️, 🎯, 🔥, etc)' },
            title: { type: 'string', description: 'Headline 5-7 kata' },
            body: { type: 'string', description: '1-2 kalimat detail dengan angka spesifik' },
            tone: {
              type: 'string',
              enum: ['positive', 'observation', 'warning'],
              description: 'positive=selamat/dorongan, observation=pattern netral, warning=action needed',
            },
          },
          required: ['emoji', 'title', 'body', 'tone'],
        },
      },
    },
    required: ['insights'],
    additionalProperties: false,
  }

  const client = new Anthropic()

  // Build user message — compact, focused on signals
  const userMsg = `Berikut ringkasan keuangan untuk ${input.period_label}:

PEMASUKAN: Rp ${input.income.toLocaleString('id-ID')}
PENGELUARAN: Rp ${input.expense.toLocaleString('id-ID')}
TABUNGAN: Rp ${input.saving.toLocaleString('id-ID')}
INVESTASI: Rp ${input.investment.toLocaleString('id-ID')}
NET CASHFLOW: Rp ${input.net.toLocaleString('id-ID')}
SAVING RATE: ${input.saving_rate.toFixed(1)}%

${input.last_month ? `BULAN LALU:
- Pemasukan: Rp ${input.last_month.income.toLocaleString('id-ID')}
- Pengeluaran: Rp ${input.last_month.expense.toLocaleString('id-ID')}
- Tabungan+Investasi: Rp ${(input.last_month.saving + input.last_month.investment).toLocaleString('id-ID')}` : ''}

PENGELUARAN PER KATEGORI (top 6):
${input.expense_by_category.slice(0, 6).map((c) => {
  const delta = c.last_month > 0 ? ((c.this_month - c.last_month) / c.last_month) * 100 : 0
  const deltaStr = c.last_month > 0 ? ` (${delta > 0 ? '+' : ''}${delta.toFixed(0)}% vs bln lalu)` : ''
  return `- ${c.category}: Rp ${c.this_month.toLocaleString('id-ID')}${deltaStr}`
}).join('\n')}

${input.top_expenses && input.top_expenses.length > 0 ? `TRANSAKSI PENGELUARAN TERBESAR (top 5):
${input.top_expenses.slice(0, 5).map((t) => `- ${t.description || t.category}: Rp ${t.amount.toLocaleString('id-ID')} (${t.category}, ${t.date})`).join('\n')}` : ''}

${input.goals && input.goals.length > 0 ? `GOAL AKTIF:
${input.goals.map((g) => `- ${g.name}: ${g.progress_pct.toFixed(0)}% tercapai, sisa Rp ${g.remaining.toLocaleString('id-ID')}${g.deadline ? `, deadline ${g.deadline}` : ''}`).join('\n')}` : ''}

${input.upcoming_bills && input.upcoming_bills.length > 0 ? `TAGIHAN MENDATANG (≤14 hari):
${input.upcoming_bills.map((b) => `- ${b.name}: Rp ${b.amount.toLocaleString('id-ID')} dalam ${b.days_until} hari`).join('\n')}` : ''}

Tanggal hari ini: ${input.today}

Generate 2-3 insight personal yang specific, actionable, dan bervariasi tone-nya.`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'generate_insights',
          description: 'Generate 2-3 personalized financial insights',
          input_schema: SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'generate_insights' },
      messages: [{ role: 'user', content: userMsg }],
    })

    const block = response.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      return NextResponse.json({ error: 'Claude tidak generate insights' }, { status: 502 })
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
      return NextResponse.json({ error: `Anthropic API error: ${err.message}` }, { status: 502 })
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
