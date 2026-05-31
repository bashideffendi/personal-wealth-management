'use client'

/**
 * Ownership network graph — Sigma (WebGL/canvas) rendered, LIGHT theme.
 *
 * Sigma touches `window` on import, jadi komponen ini WAJIB di-mount client-only
 * (lihat ownership-tab.tsx yang import lewat next/dynamic ssr:false — mirror dari
 * pola Soto map di src/components/map/).
 *
 * Node: perusahaan = emerald (var(--c-mint)) label=symbol · investor = abu
 * (var(--ink-muted)) label=name · emiten yang lagi dibuka di-highlight (gede +
 * var(--c-primary)). Ukuran node ∝ degree. Edge: tebal ∝ pct, hover munculin pct%.
 */

import { useEffect, useMemo, useState } from 'react'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from '@react-sigma/core'
import '@react-sigma/core/lib/style.css'
import type {
  OwnershipNetwork,
  OwnershipNetworkNode,
} from '@/lib/invest/ownership'

// Palet di-hardcode (Sigma render ke canvas/WebGL — gak bisa baca CSS var).
// Samain dengan token LIGHT theme di globals.css.
const C = {
  mint: '#10B981', // --c-mint  (perusahaan)
  primary: '#0A0A0F', // --c-primary (emiten aktif / ink)
  investor: '#71717A', // abu (investor) — antara --ink-muted & --ink-soft
  edge: '#D8D2C6', // hairline edge (turunan --border-soft)
  edgeHi: '#10B981', // edge ke-highlight pas hover
  label: '#0A0A0F', // --ink
  white: '#FFFFFF',
} as const

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
 * jalanin forceatlas2. Dipisah biar gampang di-memo.
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

/** Inner: load graph ke Sigma sekali graph siap. */
function LoadGraph({ graph }: { graph: Graph }) {
  const loadGraph = useLoadGraph()
  useEffect(() => {
    loadGraph(graph, true)
  }, [loadGraph, graph])
  return null
}

/**
 * Inner: setelah graph ke-load, FIT kamera ke node.
 *
 * Ini fix utama buat "blank canvas": tab Keterikatan mount HIDDEN dulu baru
 * show, jadi container Sigma sempat ke-ukur 0px → node ter-normalisasi ke
 * viewport kosong & ke-render di luar layar. Solusi: tunggu container ke-layout
 * (requestAnimationFrame) lalu `resize(true)` (ukur ulang container yang udah
 * visible) → `refresh()` → `getCamera().animatedReset()` (reset = fit ke extent
 * graph yang udah dinormalisasi Sigma ke kotak [0,1]).
 */
function FitCamera({ graph }: { graph: Graph }) {
  const sigma = useSigma()

  useEffect(() => {
    let raf1 = 0
    let raf2 = 0
    let cancelled = false

    const fit = () => {
      if (cancelled || sigma.getGraph().order === 0) return
      // Ukur ulang container (sekarang udah visible & punya tinggi) lalu render.
      sigma.resize(true)
      sigma.refresh()
      // animatedReset balikin kamera ke {x:.5,y:.5,ratio:1} = center extent graph.
      sigma.getCamera().animatedReset({ duration: 0 })
    }

    // Double-rAF: frame-1 nunggu commit DOM, frame-2 nunggu container kebagian
    // ukuran final (penting pas tab baru di-reveal dari hidden).
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(fit)
    })

    // Re-fit kalau container berubah ukuran (mis. tab di-reveal belakangan,
    // atau resize window). ResizeObserver lebih reliable daripada nebak timing.
    const el = sigma.getContainer()
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && el) {
      let first = true
      ro = new ResizeObserver(() => {
        // Skip callback pertama (initial observe) — udah di-handle rAF di atas.
        if (first) {
          first = false
          return
        }
        fit()
      })
      ro.observe(el)
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      ro?.disconnect()
    }
  }, [sigma, graph])

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
  const [tooltip, setTooltip] = useState<{ info: EdgeInfo; x: number; y: number } | null>(null)

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
          height: 440,
          background: 'var(--surface)',
          borderColor: 'var(--border-soft)',
          color: 'var(--ink-soft)',
        }}
      >
        Belum ada relasi kepemilikan buat di-gambar.
      </div>
    )
  }

  return (
    <div className="relative">
      <SigmaContainer
        graph={graph}
        style={{
          height: 440,
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
        <LoadGraph graph={graph} />
        <FitCamera graph={graph} />
        <GraphEvents onHover={handleHover} />
      </SigmaContainer>

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
          Perusahaan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: C.investor }} />
          Investor
        </span>
      </div>

      {/* Tooltip hover edge */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5 text-[11px] shadow-sm"
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
            <span className="num tabular ml-1 font-semibold" style={{ color: 'var(--c-mint)' }}>
              {tooltip.info.pct.toFixed(2)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}
