import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { FEATURES, getFeature } from '../_data'

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const f = getFeature(slug)
  if (!f) return { title: 'Fitur' }
  return { title: f.name, description: f.tagline }
}

export default async function FeatureDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const f = getFeature(slug)
  if (!f) notFound()

  const idx = FEATURES.findIndex((x) => x.slug === f.slug)
  const next = FEATURES[(idx + 1) % FEATURES.length]
  const Icon = f.icon

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-12 py-4 border-b backdrop-blur" style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="Klunting">
          <div className="grid place-items-center" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em' }}>K</div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Klunting</span>
        </Link>
        <nav className="hidden md:flex gap-7 text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
          <Link href="/features" className="text-[var(--ink)]">Fitur</Link>
          <Link href="/#harga" className="hover:text-[var(--ink)] transition-colors">Harga</Link>
          <Link href="/#faq" className="hover:text-[var(--ink)] transition-colors">FAQ</Link>
          <Link href="/about" className="hover:text-[var(--ink)] transition-colors">Tentang</Link>
        </nav>
        <Link href="/register" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
          Coba gratis <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <main className="px-6 sm:px-12 py-12 sm:py-16">
        {/* Breadcrumb */}
        <div className="max-w-5xl mx-auto">
          <Link href="/features" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>
            <ArrowLeft className="size-3.5" /> Semua fitur
          </Link>
        </div>

        {/* Hero */}
        <div className="max-w-3xl mx-auto mt-6">
          <div className="size-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <Icon className="size-6" style={{ color: 'var(--ink)' }} />
          </div>
          <h1 className="font-bold tracking-tight" style={{ fontSize: 'clamp(30px, 4.4vw, 46px)', lineHeight: 1.08, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            {f.name}
          </h1>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{f.intro}</p>
        </div>

        {/* Screenshot */}
        {f.shot && (
          <div className="max-w-5xl mx-auto mt-10">
            <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)', boxShadow: '0 40px 90px -36px rgba(16,24,40,0.45)', background: 'var(--surface)' }}>
              <div className="flex items-center gap-2 px-4 h-9 border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}>
                <span className="size-2.5 rounded-full" style={{ background: '#ED7385' }} />
                <span className="size-2.5 rounded-full" style={{ background: '#E3A93C' }} />
                <span className="size-2.5 rounded-full" style={{ background: '#5CCB9F' }} />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.shot} alt={f.shotAlt ?? f.name} className="w-full h-auto block" />
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="max-w-4xl mx-auto mt-14 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-9">
          {f.sections.map((s) => (
            <div key={s.title}>
              <div className="flex items-center gap-2 mb-2">
                <span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--c-mint)' }} />
                <h2 className="text-base font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>{s.title}</h2>
              </div>
              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{s.body}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        {f.faq.length > 0 && (
          <div className="max-w-3xl mx-auto mt-16">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>Pertanyaan</h2>
            <div className="mt-4 space-y-2">
              {f.faq.map((item) => (
                <details key={item.q} className="group rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <summary className="list-none cursor-pointer px-5 py-4 text-[15px] font-medium flex items-center justify-between gap-3" style={{ color: 'var(--ink)' }}>
                    {item.q}
                    <span className="shrink-0 transition-transform group-open:rotate-45" style={{ color: 'var(--ink-soft)' }}>+</span>
                  </summary>
                  <p className="px-5 pb-4 text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* CTA + next feature */}
        <div className="max-w-5xl mx-auto mt-16 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between rounded-2xl p-8 sm:p-9" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-bold tracking-tight" style={{ color: 'var(--ink)', fontSize: 'clamp(20px, 2.4vw, 26px)', letterSpacing: '-0.02em' }}>Coba sendiri, gratis 21 hari.</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>Tanpa kartu kredit. Batalkan kapan saja.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href={`/features/${next.slug}`} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium border transition hover:bg-[var(--surface-2)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}>
              {next.name} <ArrowRight className="size-4" />
            </Link>
            <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
              Mulai <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        {/* trust line */}
        <div className="max-w-5xl mx-auto mt-6 flex items-center gap-x-5 gap-y-2 flex-wrap text-[12px]" style={{ color: 'var(--ink-soft)' }}>
          {['Akses penuh 21 hari', 'Tanpa kartu kredit', 'Data dienkripsi, tidak dijual'].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5"><Check className="size-3.5" style={{ color: 'var(--c-mint)' }} /> {t}</span>
          ))}
        </div>
      </main>

      <footer className="border-t px-6 sm:px-12 py-8" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">Beranda</Link>
          <Link href="/features" className="hover:text-[var(--ink)] transition-colors">Fitur</Link>
          <Link href="/#harga" className="hover:text-[var(--ink)] transition-colors">Harga</Link>
          <Link href="/about" className="hover:text-[var(--ink)] transition-colors">Tentang</Link>
          <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">Privasi</Link>
        </div>
      </footer>
    </div>
  )
}
