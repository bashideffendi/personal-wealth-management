import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { consumeAICredits, refundAICredits } from '@/lib/ai-credits'
import { rateLimit } from '@/lib/rate-limit'
import {
  getStock,
  getValuation,
  getValuationDetail,
  getEmittenStat,
  getDividendsForTicker,
} from '@/lib/invest/stocks'
import { SYSTEM_PROMPT, buildResearchPrompt } from '@/lib/invest/research-prompt'

export const runtime = 'nodejs'
export const maxDuration = 300

interface RouteContext {
  params: Promise<{ ticker: string }>
}

const MAX_OUTPUT_TOKENS = 4096

export async function POST(request: NextRequest, context: RouteContext) {
  // ?force=1 → bypass the shared cache and regenerate fresh (e.g. after newer
  // financial statements land). Costs credits like a first generation.
  const force = request.nextUrl.searchParams.get('force') === '1'
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

  const { ticker: rawTicker } = await context.params
  const ticker = rawTicker.toUpperCase()

  // Sanity: stock exists?
  const stock = getStock(ticker)
  if (!stock) {
    return NextResponse.json(
      { error: `Ticker ${ticker} tidak ditemukan di database` },
      { status: 404 },
    )
  }

  // Cek cache dulu — kalau udah ada, return cached (gak charge credit)
  const { data: cached } = await supabase
    .from('stock_research_cache')
    .select('content, frontmatter, generated_at, model')
    .eq('ticker', ticker)
    .maybeSingle()

  if (cached && !force) {
    return NextResponse.json({
      ticker,
      content: cached.content,
      frontmatter: cached.frontmatter,
      generated_at: cached.generated_at,
      model: cached.model,
      cached: true,
    })
  }

  // Charge credits sebelum panggil Claude
  const credit = await consumeAICredits(supabase, user.id, 'stock_research')
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error }, { status: credit.status })
  }

  const valuation = getValuation(ticker)
  const valuationDetail = getValuationDetail(ticker)
  const stats = getEmittenStat(ticker)
  const dividends = getDividendsForTicker(ticker)

  const userPrompt = buildResearchPrompt({
    stock,
    valuation: valuation ?? null,
    valuationDetail: valuationDetail ?? null,
    stats: stats ?? null,
    dividends,
  })

  const client = new Anthropic()

  let markdown = ''
  let inputTokens = 0
  let outputTokens = 0
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    if (response.stop_reason === 'refusal') {
      await refundAICredits(supabase, user.id, 'stock_research')
      return NextResponse.json(
        { error: 'Claude menolak generate research untuk ticker ini.' },
        { status: 422 },
      )
    }

    // Output kepotong = riset rusak. Jangan lanjut — cache-nya SHARED antar
    // user, sekali kesimpen semua orang dapet research buntung.
    if (response.stop_reason === 'max_tokens') {
      await refundAICredits(supabase, user.id, 'stock_research')
      return NextResponse.json(
        { error: 'Output research kepotong (kepanjangan). Coba generate ulang.' },
        { status: 502 },
      )
    }

    // Concat all text blocks
    for (const block of response.content) {
      if (block.type === 'text') markdown += block.text
    }
    inputTokens = response.usage.input_tokens
    outputTokens = response.usage.output_tokens

    if (!markdown.trim()) {
      await refundAICredits(supabase, user.id, 'stock_research')
      return NextResponse.json(
        { error: 'Claude balikin output kosong, coba lagi.' },
        { status: 502 },
      )
    }
  } catch (err) {
    await refundAICredits(supabase, user.id, 'stock_research')
    console.error('[idx-research/generate] failed:', err)
    return NextResponse.json({ error: 'Layanan riset AI lagi bermasalah, coba lagi.' }, { status: 502 })
  }

  // Parse frontmatter dari output Claude
  const fm = parseFrontmatter(markdown)

  // Save ke cache (shared across users)
  const { error: insErr } = await supabase
    .from('stock_research_cache')
    .upsert(
      {
        ticker,
        content: markdown,
        frontmatter: fm,
        generated_at: new Date().toISOString(),
        generated_by: user.id,
        model: 'claude-haiku-4-5',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
      { onConflict: 'ticker' },
    )

  if (insErr) {
    // Don't refund — content sudah berhasil di-generate, cuma gagal save.
    // User dapet hasilnya, tinggal regenerate kalau hilang.
    console.error('Failed to cache research:', insErr.message)
  }

  return NextResponse.json({
    ticker,
    content: markdown,
    frontmatter: fm,
    generated_at: new Date().toISOString(),
    model: 'claude-haiku-4-5',
    cached: false,
    credits_remaining: credit.remaining,
  })
}

function parseFrontmatter(md: string): Record<string, string | number> {
  const m = md.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const fm: Record<string, string | number> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.+)$/)
    if (!kv) continue
    const value = kv[2].trim()
    fm[kv[1]] = /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value
  }
  return fm
}
