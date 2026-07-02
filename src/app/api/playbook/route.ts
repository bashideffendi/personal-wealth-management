import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { anthropic, AI_MODEL } from '@/lib/ai/client'
import { createClient } from '@/lib/supabase/server'
import { consumeAICredits, refundAICredits } from '@/lib/ai-credits'
import { rateLimit } from '@/lib/rate-limit'
import { getPlaybook } from '@/lib/playbooks'

export const runtime = 'nodejs'
export const maxDuration = 120

const SYSTEM_PROMPT = `Kamu adalah Personal Finance Advisor untuk app Klunting Indonesia. User memilih sebuah "playbook" (skenario keuangan) dan mengisi angka-angka mereka. Tugasmu: susun RENCANA konkret yang bisa langsung dijalankan.

Style:
- Casual tapi profesional (target millennial Indonesia), pakai "kamu"
- SELALU spesifik dengan angka Rupiah hasil hitungan dari input user — bukan generic
- Realistis & jujur: kalau setoran bulanan user kekecilan buat target & waktunya, katakan apa adanya dan kasih opsi (perpanjang waktu / naikkan setoran / turunkan target)
- Konteks Indonesia: kenal RDPU, deposito, SBN ritel, reksa dana syariah, tabungan haji bank syariah, BPHTB, dll
- JANGAN mengarang angka resmi yang berubah-ubah (biaya haji, harga properti, dll) sebagai fakta pasti — perlakukan angka user sebagai asumsi dan beri catatan "cek angka terbaru" bila relevan
- Bukan nasihat investasi yang dipersonalisasi/terjamin — ini edukasi & perencanaan umum

Hitung dengan benar:
- Total dana yang perlu disiapkan dari input
- Berapa sisa yang masih kurang (target - sudah terkumpul)
- Setoran bulanan = sisa / jumlah bulan target (kalau ada timeline)
- Estimasi waktu selesai kalau setoran sudah ditentukan user

Output via tool call. Semua angka dalam Rupiah (integer, tanpa desimal).`

interface PlaybookBody {
  slug: string
  inputs: Record<string, string | number>
  today?: string
}

const SCHEMA: Anthropic.Tool.InputSchema = {
  type: 'object',
  properties: {
    ringkasan: {
      type: 'string',
      description: '2-3 kalimat ringkasan rencana, menyebut angka kunci hasil hitungan',
    },
    targetTotal: { type: 'number', description: 'Total dana yang perlu disiapkan (Rupiah, integer)' },
    sisaKurang: { type: 'number', description: 'Sisa yang masih harus dikumpulkan = target - sudah terkumpul (Rupiah)' },
    setoranBulanan: { type: 'number', description: 'Saran nabung per bulan (Rupiah, integer)' },
    estimasiSelesai: {
      type: 'string',
      description: 'Estimasi kapan target tercapai, mis. "sekitar 18 bulan" atau "pertengahan 2028"',
    },
    milestones: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          judul: { type: 'string', description: 'Nama milestone, mis. "Dana darurat 1 bulan"' },
          target: { type: 'string', description: 'Target angka/kondisi milestone ini, mis. "Rp 5.000.000"' },
          kapan: { type: 'string', description: 'Perkiraan waktu, mis. "Bulan ke-3"' },
        },
        required: ['judul', 'target', 'kapan'],
      },
    },
    tips: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: { type: 'string' },
      description: 'Tips konkret & spesifik konteks Indonesia',
    },
    perhatian: {
      type: 'array',
      minItems: 0,
      maxItems: 3,
      items: { type: 'string' },
      description: 'Hal yang perlu diwaspadai / catatan kejujuran (mis. setoran kekecilan, angka perlu dicek)',
    },
  },
  required: ['ringkasan', 'targetTotal', 'setoranBulanan', 'estimasiSelesai', 'milestones', 'tips'],
  additionalProperties: false,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai:${user.id}`)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan AI. Coba lagi dalam ${rl.retryAfterSec} detik.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY tidak terkonfigurasi' }, { status: 500 })
  }

  let body: PlaybookBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 })
  }

  const playbook = getPlaybook(body.slug)
  if (!playbook) {
    return NextResponse.json({ error: 'Playbook tidak dikenal' }, { status: 400 })
  }

  // Jangan charge kredit kalau user belum isi angka apapun. Hitung field
  // NUMBER saja — select punya nilai default yang selalu ikut kekirim,
  // jadi kalau dihitung guard ini gak pernah kena (placebo).
  const filledCount = playbook.inputs.filter((f) => {
    if (f.type !== 'number') return false
    const v = body.inputs?.[f.key]
    return v !== undefined && v !== '' && v !== null
  }).length
  if (filledCount === 0) {
    return NextResponse.json({ error: 'Isi minimal satu angka dulu biar rencananya relevan.' }, { status: 400 })
  }

  // Charge credits before generating
  const credit = await consumeAICredits(supabase, user.id, 'playbook')
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error }, { status: credit.status })
  }

  // Build prompt from playbook template + user inputs (label-resolved).
  const inputLines: string[] = []
  for (const field of playbook.inputs) {
    const raw = body.inputs?.[field.key]
    if (raw === undefined || raw === '' || raw === null) continue
    let valueStr: string
    if (field.type === 'select') {
      const opt = field.options?.find((o) => o.value === String(raw))
      valueStr = opt?.label ?? String(raw)
    } else {
      const n = Number(raw)
      valueStr = Number.isFinite(n)
        ? `${field.prefix ? field.prefix + ' ' : ''}${n.toLocaleString('id-ID')}`
        : String(raw)
    }
    inputLines.push(`- ${field.label}: ${valueStr}`)
  }

  const sections: string[] = []
  sections.push(`PLAYBOOK: ${playbook.title}`)
  sections.push(playbook.intro)
  sections.push('')
  sections.push('Langkah baku playbook ini:')
  playbook.steps.forEach((s, i) => sections.push(`${i + 1}. ${s.title} — ${s.detail}`))
  sections.push('')
  sections.push('ANGKA DARI USER:')
  sections.push(inputLines.length ? inputLines.join('\n') : '(user belum mengisi angka — beri rencana umum + minta isi angka)')
  sections.push('')
  if (body.today) sections.push(`Tanggal hari ini: ${body.today}`)
  sections.push('')
  sections.push(
    'Susun rencana terpersonalisasi: hitung target total, sisa yang kurang, setoran bulanan, estimasi selesai, milestone bertahap, tips konkret, dan hal yang perlu diperhatikan. Pakai angka user.',
  )

  const client = anthropic()

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2400,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'buat_rencana',
          description: 'Susun rencana finansial terpersonalisasi dari playbook + angka user',
          input_schema: SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'buat_rencana' },
      messages: [{ role: 'user', content: sections.join('\n') }],
    })

    // Output kepotong karena max_tokens → JSON parsial (angka jadi 'Rp 0'). Refund + error.
    if (response.stop_reason === 'max_tokens') {
      await refundAICredits(supabase, user.id, 'playbook')
      return NextResponse.json({ error: 'Rencana kepotong (terlalu panjang). Coba lagi.' }, { status: 502 })
    }
    const block = response.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      await refundAICredits(supabase, user.id, 'playbook')
      return NextResponse.json({ error: 'Claude tidak menghasilkan rencana' }, { status: 502 })
    }
    const planOut = block.input as { targetTotal?: unknown; setoranBulanan?: unknown; milestones?: unknown }
    if (
      !Number.isFinite(Number(planOut.targetTotal)) ||
      !Number.isFinite(Number(planOut.setoranBulanan)) ||
      !Array.isArray(planOut.milestones)
    ) {
      await refundAICredits(supabase, user.id, 'playbook')
      return NextResponse.json({ error: 'Rencana yang dihasilkan tidak valid. Kredit dikembalikan — coba lagi.' }, { status: 502 })
    }

    return NextResponse.json({
      data: block.input,
      remaining: credit.remaining,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    })
  } catch (err) {
    await refundAICredits(supabase, user.id, 'playbook')
    // Detail error cuma buat log server — err.message SDK bisa bawa detail
    // internal (request id dsb.) yang gak ada gunanya di toast user.
    console.error('[api/playbook]', err)
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: 'Layanan AI lagi bermasalah. Kredit dikembalikan — coba lagi.' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan. Kredit dikembalikan — coba lagi.' }, { status: 500 })
  }
}
