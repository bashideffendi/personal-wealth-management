'use client'

/**
 * Ownership network graph — Sigma (WebGL/canvas) rendered, LIGHT theme.
 *
 * Sigma touches `window` on import, jadi komponen ini WAJIB di-mount client-only
 * (lihat ownership-tab.tsx yang import lewat next/dynamic ssr:false — mirror dari
 * pola Soto map di src/components/map/).
 *
 * Node: perusahaan = emerald (#129B69) label=symbol · investor = abu (#71717A)
 * label=name · emiten yang lagi dibuka di-highlight (gede + ink #0A0A0F).
 * Ukuran node ∝ degree (clamp 6–20). Edge: tebal ∝ pct, hover munculin pct%.
 *
 * ─── Anti flash-then-blank ───
 * Tab "Struktur Kepemilikan" pakai base-ui TabsPanel: pas panel ke-reveal ada transition,
 * dan container sempat ke-ukur 0px / transient size. Kalau Sigma init di situ +
 * ada loop re-fit (ResizeObserver), graf sempat ke-gambar lalu ke-blank lagi pas
 * re-fit nge-normalisasi ke viewport kosong.
 *
 * Fix: (1) Sigma cuma di-MOUNT pas host element beneran `visible && sized`
 * (IntersectionObserver) → container udah punya ukuran final, auto-fit default
 * Sigma langsung bener. (2) Build graph + forceAtlas2 SEKALI (useMemo deps stabil).
 * (3) Fit kamera SEKALI (single rAF) — gak ada loop re-fit. Re-fit cuma pas window
 * resize beneran, debounced, dan cuma kalau width/height > 0.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import {
  SigmaContainer,
  useRegisterEvents,
  useSigma,
} from '@react-sigma/core'
import '@react-sigma/core/lib/style.css'
import type {
  OwnershipNetwork,
  OwnershipNetworkNode,
} from '@/lib/invest/ownership'
import { useT } from '@/lib/i18n/context'

// Palet di-hardcode (Sigma render ke canvas/WebGL — gak bisa baca CSS var).
// Samain dengan token LIGHT theme di globals.css.
const C = {
  mint: '#129B69', // --c-mint  (perusahaan)
  primary: '#0A0A0F', // --c-primary (emiten aktif / ink)
  investor: '#71717A', // abu (investor) — antara --ink-muted & --ink-soft
  edge: '#D8D2C6', // hairline edge (turunan --border-soft)
  edgeHi: '#129B69', // edge ke-highlight pas hover
  label: '#0A0A0F', // --ink
  white: '#FFFFFF',
} as const

const GRAPH_HEIGHT = 600

interface GraphData {
  network: OwnershipNetwork
  activeId: string | null
}

/** Ringkasan satu edge buat tooltip hover. */
interface EdgeInfo {
  fromLabel: string
  toLabel: string
  pct: number | null
}

function nodeLabel(n: OwnershipNetworkNode): string {
  if (n.kind === 'company') return n.symbol || n.name || n.id
  return n.name || n.id
}

/**
 * Bangun graphology Graph dari network, set warna/ukuran/posisi awal, lalu
 * jalanin forceatlas2. Dipanggil SEKALI lewat useMemo (deps stabil) — JANGAN
 * tiap render, biar gak ada reload-flicker.
 */
function buildGraph(network: OwnershipNetwork, activeId: string | null): Graph {
  const graph = new Graph({ multi: false, type: 'directed' })

  // Degree dihitung manual (in+out) buat nentuin ukuran node.
  const degree = new Map<string, number>()
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1)
  for (const e of network.edges) {
    if (e.from) bump(e.from)
    if (e.to) bump(e.to)
  }

  // Simpan seed lingkaran per node — dipakai buat restore kalau forceAtlas2
  // ngeluarin NaN (graf disconnected / order kecil bisa bikin koordinat invalid).
  const seed = new Map<string, { x: number; y: number }>()

  const n = network.nodes.length || 1
  network.nodes.forEach((node, i) => {
    if (!node.id || graph.hasNode(node.id)) return
    const deg = degree.get(node.id) ?? 0
    const isCompany = node.kind === 'company'
    const isActive = node.id === activeId

    // Ukuran: base + skala degree (clamp 6–20). Emiten aktif paling gede.
    const size = isActive ? 18 : Math.max(6, Math.min(20, 8 + deg * 1.6))

    // Posisi awal di lingkaran (forceatlas2 butuh koordinat non-zero & non-collinear).
    // Jitter kecil biar node degree-0 gak ketumpuk persis di titik yang sama.
    const angle = (2 * Math.PI * i) / n
    const sx = Math.cos(angle) + (Math.random() - 0.5) * 0.05
    const sy = Math.sin(angle) + (Math.random() - 0.5) * 0.05
    seed.set(node.id, { x: sx, y: sy })

    graph.addNode(node.id, {
      label: nodeLabel(node),
      x: sx,
      y: sy,
      size,
      color: isActive ? C.primary : isCompany ? C.mint : C.investor,
      // Atribut custom buat ring highlight & tooltip.
      kind: node.kind ?? 'investor',
      active: isActive,
      borderColor: isActive ? C.primary : C.white,
      fullName: node.name ?? '',
      symbol: node.symbol ?? '',
    })
  })

  // Edge: arah from→to (pemegang → dipegang), tebal ∝ pct.
  for (const e of network.edges) {
    if (!e.from || !e.to) continue
    if (!graph.hasNode(e.from) || !graph.hasNode(e.to)) continue
    if (graph.hasDirectedEdge(e.from, e.to)) continue
    const pct = e.pct ?? 0
    graph.addDirectedEdge(e.from, e.to, {
      size: Math.max(0.8, Math.min(6, pct / 12)),
      color: C.edge,
      pct: e.pct,
      type: 'arrow',
    })
  }

  // Layout forceatlas2 — beberapa ratus iterasi, settings auto-infer dari order.
  if (graph.order > 1) {
    const settings = forceAtlas2.inferSettings(graph)
    forceAtlas2.assign(graph, {
      iterations: 300,
      settings: {
        ...settings,
        gravity: 1,
        scalingRatio: 4,
        barnesHutOptimize: graph.order > 50,
      },
    })
  }

  // GUARD: kalau layout ngeluarin x/y NaN/undefined/Infinity (bisa kejadian di
  // graf disconnected), balikin ke seed lingkaran biar Sigma gak gambar blank.
  graph.forEachNode((id, attr) => {
    const x = attr.x as number
    const y = attr.y as number
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const s = seed.get(id) ?? { x: 0, y: 0 }
      graph.setNodeAttribute(id, 'x', s.x)
      graph.setNodeAttribute(id, 'y', s.y)
    }
  })

  return graph
}

/**
 * Inner: fit kamera SEKALI setelah Sigma mount (di container yang udah sized),
 * lalu re-fit HANYA pas window resize beneran (debounced, guard width/height>0).
 *
 * Karena SigmaContainer baru di-mount pas host `visible && sized` (lihat
 * OwnershipGraph), container-nya udah punya ukuran final di sini — auto-fit
 * default Sigma harusnya udah bener; rAF + animatedReset cuma mastiin centered.
 * SENGAJA gak pakai ResizeObserver re-fit loop (itu yang bikin flash-then-blank:
 * observer re-fire ke transient/zero size → animatedReset ke viewport kosong).
 */
function FitCamera() {
  const sigma = useSigma()

  useEffect(() => {
    let raf = 0
    let cancelled = false

    const fitOnce = () => {
      if (cancelled || sigma.getGraph().order === 0) return
      sigma.refresh()
      // animatedReset balikin kamera ke {x:.5,y:.5,ratio:1} = center extent graph.
      sigma.getCamera().animatedReset({ duration: 0 })
    }

    // Single rAF: nunggu commit DOM/layout sekali, terus fit. TANPA loop.
    raf = requestAnimationFrame(fitOnce)

    // Re-fit cuma pas WINDOW resize beneran (bukan reveal awal, bukan size 0),
    // debounced ~200ms biar gak spam pas drag-resize.
    let debounce: ReturnType<typeof setTimeout> | null = null
    const onResize = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        if (cancelled) return
        const el = sigma.getContainer()
        if (!el || el.clientWidth <= 0 || el.clientHeight <= 0) return
        sigma.resize()
        sigma.refresh()
        sigma.getCamera().animatedReset({ duration: 0 })
      }, 200)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (debounce) clearTimeout(debounce)
      window.removeEventListener('resize', onResize)
    }
  }, [sigma])

  return null
}

/** Inner: hover handler — set node hover + cari edge buat tooltip. */
function GraphEvents({
  onHover,
}: {
  onHover: (info: EdgeInfo | null, x: number, y: number) => void
}) {
  const sigma = useSigma()
  const registerEvents = useRegisterEvents()

  useEffect(() => {
    registerEvents({
      enterEdge: (e) => {
        const g = sigma.getGraph()
        const pct = g.getEdgeAttribute(e.edge, 'pct') as number | null
        const [from, to] = g.extremities(e.edge)
        onHover(
          {
            fromLabel: (g.getNodeAttribute(from, 'fullName') as string) ||
              (g.getNodeAttribute(from, 'label') as string),
            toLabel: (g.getNodeAttribute(to, 'symbol') as string) ||
              (g.getNodeAttribute(to, 'label') as string),
            pct,
          },
          e.event.x,
          e.event.y,
        )
        // Highlight edge yang di-hover.
        g.setEdgeAttribute(e.edge, 'color', C.edgeHi)
        g.setEdgeAttribute(e.edge, 'size', Math.max(2, g.getEdgeAttribute(e.edge, 'size') as number))
        sigma.refresh()
      },
      leaveEdge: (e) => {
        const g = sigma.getGraph()
        const pct = (g.getEdgeAttribute(e.edge, 'pct') as number | null) ?? 0
        g.setEdgeAttribute(e.edge, 'color', C.edge)
        g.setEdgeAttribute(e.edge, 'size', Math.max(0.8, Math.min(6, pct / 12)))
        sigma.refresh()
        onHover(null, 0, 0)
      },
    })
  }, [registerEvents, sigma, onHover])

  return null
}

export default function OwnershipGraph({ network, activeId }: GraphData) {
  const t = useT()
  const [tooltip, setTooltip] = useState<{ info: EdgeInfo; x: number; y: number } | null>(null)

  // Host visibility gate: Sigma cuma di-mount pas panel beneran kelihatan & udah
  // punya ukuran (>0px). Ini bikin Sigma init di container yang sized → auto-fit
  // default-nya langsung bener, gak ada init-di-0px lalu re-fit yang nge-blank.
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: kalau IO gak ada, langsung tampil (best-effort).
      setVisible(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const r = entry.boundingClientRect
          if (entry.isIntersecting && r.width > 0 && r.height > 0) {
            setVisible(true)
            io.disconnect() // sekali kelihatan, cukup — gak perlu observe lagi.
            break
          }
        }
      },
      { threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Build graph + forceAtlas2 SEKALI. Deps = referensi network + activeId yang
  // STABIL dari props (server-fetched, gak di-recreate tiap render parent), jadi
  // ini gak re-run pas parent re-render (mis. regenerate research).
  const graph = useMemo(() => buildGraph(network, activeId), [network, activeId])

  const handleHover = (info: EdgeInfo | null, x: number, y: number) => {
    if (info) setTooltip({ info, x, y })
    else setTooltip(null)
  }

  if (!network?.nodes?.length) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border text-sm"
        style={{
          height: GRAPH_HEIGHT,
          background: 'var(--surface)',
          borderColor: 'var(--border-soft)',
          color: 'var(--ink-soft)',
        }}
      >
        {t('ownership_graph.emptyState')}
      </div>
    )
  }

  return (
    <div ref={hostRef} className="relative" style={{ height: GRAPH_HEIGHT, width: '100%' }}>
      {visible ? (
        <SigmaContainer
          graph={graph}
          style={{
            height: GRAPH_HEIGHT,
            width: '100%',
            borderRadius: 12,
            background: '#FFFFFF',
          }}
          settings={{
            labelColor: { color: C.label },
            labelSize: 12,
            labelWeight: '600',
            labelFont: 'var(--font-sans, system-ui), sans-serif',
            defaultEdgeType: 'arrow',
            renderEdgeLabels: false,
            zIndex: true,
            minCameraRatio: 0.2,
            maxCameraRatio: 4,
          }}
        >
          <FitCamera />
          <GraphEvents onHover={handleHover} />
        </SigmaContainer>
      ) : (
        // Placeholder dengan dimensi yang sama biar IO langsung lihat tinggi >0.
        <div
          className="flex items-center justify-center rounded-xl text-xs"
          style={{
            height: GRAPH_HEIGHT,
            width: '100%',
            background: '#FFFFFF',
            color: 'var(--ink-soft)',
          }}
        >
          {t('ownership_graph.preparing')}
        </div>
      )}

      {/* Legend */}
      <div
        className="absolute top-3 left-3 flex items-center gap-3 rounded-lg border px-3 py-1.5 text-[11px]"
        style={{
          background: 'rgba(255,255,255,0.92)',
          borderColor: 'var(--border-soft)',
          color: 'var(--ink-muted)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: 'var(--c-mint)' }} />
          {t('ownership_graph.company')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: C.investor }} />
          {t('ownership_graph.investor')}
        </span>
      </div>

      {/* Tooltip hover edge */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5 text-[11px] shadow-[var(--card-shadow)]"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y + 12,
            background: 'var(--surface)',
            borderColor: 'var(--border-soft)',
            color: 'var(--ink)',
            maxWidth: 240,
          }}
        >
          <span style={{ color: 'var(--ink-muted)' }}>{tooltip.info.fromLabel}</span>
          {' → '}
          <span style={{ fontWeight: 600 }}>{tooltip.info.toLabel}</span>
          {tooltip.info.pct != null && (
            <span className="num tabular ml-1 font-semibold" style={{ color: 'var(--c-mint-ink)' }}>
              {tooltip.info.pct.toFixed(2)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}
