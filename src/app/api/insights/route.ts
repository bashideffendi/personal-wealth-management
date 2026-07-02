import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { anthropic, AI_MODEL } from '@/lib/ai/client'
import { createClient } from '@/lib/supabase/server'
import { consumeAICredits, refundAICredits } from '@/lib/ai-credits'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 120

const SYSTEM_PROMPT = `Kamu adalah Personal Finance Advisor untuk app Klunting Indonesia. User mengirim ringkasan keuangan mereka, kamu balas dengan 2-3 insight personal yang ACTIONABLE.

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

  // Parse + validate body BEFORE charging credits (jangan bakar kredit user buat
  // request jelek). Coerce numerik & default array supaya section-builder di bawah
  // GAK BISA crash di input.expense_by_category.filter(...) — bug input-2.
  let input: InsightInput
  try {
    const raw = (await request.json()) as Record<string, unknown>
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    const lm = raw.last_month && typeof raw.last_month === 'object' ? (raw.last_month as Record<string, unknown>) : null
    input = {
      period_label: typeof raw.period_label === 'string' ? raw.period_label : '',
      income: num(raw.income), expense: num(raw.expense), saving: num(raw.saving),
      investment: num(raw.investment), net: num(raw.net), saving_rate: num(raw.saving_rate),
      last_month: lm ? { income: num(lm.income), expense: num(lm.expense), saving: num(lm.saving), investment: num(lm.investment) } : undefined,
      expense_by_category: (Array.isArray(raw.expense_by_category) ? raw.expense_by_category : []) as InsightInput['expense_by_category'],
      top_expenses: (Array.isArray(raw.top_expenses) ? raw.top_expenses : []) as InsightInput['top_expenses'],
      goals: (Array.isArray(raw.goals) ? raw.goals : []) as InsightInput['goals'],
      upcoming_bills: (Array.isArray(raw.upcoming_bills) ? raw.upcoming_bills : []) as InsightInput['upcoming_bills'],
      today: typeof raw.today === 'string' ? raw.today : new Date().toISOString().slice(0, 10),
    }
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 })
  }

  // Charge 2 credits only AFTER body is validated
  const credit = await consumeAICredits(supabase, user.id, 'insights')
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error }, { status: credit.status })
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

  const client = anthropic()

  // Build user message — compact, focused on signals.
  //
  // Sparse data guard: if user has < 3 transactions worth of category data,
  // we tell Claude this is an onboarding scenario and ask for encouraging,
  // forward-looking insights instead of analytical ones (which would be
  // hollow with no real data to chew on).
  const hasMeaningfulCategoryData = input.expense_by_category
    .filter((c) => c.this_month > 0).length >= 2
  const isSparse = !hasMeaningfulCategoryData && input.expense < 100_000

  const sections: string[] = []
  sections.push(`Berikut ringkasan keuangan untuk ${input.period_label}:`)
  sections.push('')
  sections.push(`PEMASUKAN: Rp ${input.income.toLocaleString('id-ID')}`)
  sections.push(`PENGELUARAN: Rp ${input.expense.toLocaleString('id-ID')}`)
  sections.push(`TABUNGAN: Rp ${input.saving.toLocaleString('id-ID')}`)
  sections.push(`INVESTASI: Rp ${input.investment.toLocaleString('id-ID')}`)
  sections.push(`NET CASHFLOW: Rp ${input.net.toLocaleString('id-ID')}`)
  sections.push(`SAVING RATE: ${input.saving_rate.toFixed(1)}%`)

  if (input.last_month) {
    sections.push('')
    sections.push('BULAN LALU:')
    sections.push(`- Pemasukan: Rp ${input.last_month.income.toLocaleString('id-ID')}`)
    sections.push(`- Pengeluaran: Rp ${input.last_month.expense.toLocaleString('id-ID')}`)
    sections.push(`- Tabungan+Investasi: Rp ${(input.last_month.saving + input.last_month.investment).toLocaleString('id-ID')}`)
  }

  if (input.expense_by_category.some((c) => c.this_month > 0)) {
    sections.push('')
    sections.push('PENGELUARAN PER KATEGORI (top 6):')
    for (const c of input.expense_by_category.slice(0, 6)) {
      if (c.this_month <= 0) continue
      const delta = c.last_month > 0 ? ((c.this_month - c.last_month) / c.last_month) * 100 : 0
      const deltaStr = c.last_month > 0 ? ` (${delta > 0 ? '+' : ''}${delta.toFixed(0)}% vs bln lalu)` : ''
      sections.push(`- ${c.category}: Rp ${c.this_month.toLocaleString('id-ID')}${deltaStr}`)
    }
  }

  if (input.top_expenses && input.top_expenses.length > 0) {
    sections.push('')
    sections.push('TRANSAKSI PENGELUARAN TERBESAR (top 5):')
    for (const t of input.top_expenses.slice(0, 5)) {
      sections.push(`- ${t.description || t.category}: Rp ${t.amount.toLocaleString('id-ID')} (${t.category}, ${t.date})`)
    }
  }

  if (input.goals && input.goals.length > 0) {
    sections.push('')
    sections.push('GOAL AKTIF:')
    for (const g of input.goals) {
      sections.push(`- ${g.name}: ${g.progress_pct.toFixed(0)}% tercapai, sisa Rp ${g.remaining.toLocaleString('id-ID')}${g.deadline ? `, deadline ${g.deadline}` : ''}`)
    }
  }

  if (input.upcoming_bills && input.upcoming_bills.length > 0) {
    sections.push('')
    sections.push('TAGIHAN MENDATANG (≤14 hari):')
    for (const b of input.upcoming_bills) {
      sections.push(`- ${b.name}: Rp ${b.amount.toLocaleString('id-ID')} dalam ${b.days_until} hari`)
    }
  }

  sections.push('')
  sections.push(`Tanggal hari ini: ${input.today}`)
  sections.push('')
  if (isSparse) {
    sections.push('CATATAN: User masih baru pakai app — data sangat tipis. Generate 2 insight yang welcoming, edukatif, dan dorong user catat lebih banyak transaksi. Hindari analisis pattern (datanya belum cukup). Contoh tone: "Selamat mulai catat keuangan! Coba log 1 transaksi tiap hari minggu ini biar kita bisa kasih insight yang lebih dalam."')
  } else {
    sections.push('Generate 2-3 insight personal yang specific, actionable, dan bervariasi tone-nya.')
  }

  const userMsg = sections.join('\n')

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
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
      // Refund — got a response but no insights tool call
      await refundAICredits(supabase, user.id, 'insights')
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
    // Refund credits since the call failed; log real error server-side, return generic
    await refundAICredits(supabase, user.id, 'insights')
    console.error('[insights] generation failed:', err)
    return NextResponse.json({ error: 'Gagal membuat insight. Coba lagi sebentar.' }, { status: 502 })
  }
}
