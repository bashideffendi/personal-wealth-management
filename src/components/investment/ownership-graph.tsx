'use client'

/**
 * Ownership network graph — Sigma (WebGL/canvas), tool EKSPLORASI.
 *
 * Sigma touches `window` on import, jadi komponen ini WAJIB di-mount client-only
 * (lihat ownership-tab.tsx yang import lewat next/dynamic ssr:false — mirror dari
 * pola Soto map di src/components/map/).
 *
 * Node: perusahaan = teal (--c-mint) label=symbol · investor = abu (--ink-soft)
 * label=name · emiten yang lagi dibuka di-highlight (gede + --ink).
 * Ukuran node ∝ degree (clamp 6–20). Edge: tebal ∝ pct, hover munculin pct%.
 *
 * ─── Interaksi eksplorasi (desktop ≥md; mobile tetap perilaku lama) ───
 *  - Klik node perusahaan ber-ticker → buka halaman research emiten tsb.
 *  - Klik node investor / emiten aktif → toggle fokus: tetangga di-highlight,
 *    node+edge lain diredupin (nodeReducer/edgeReducer). Klik area kosong = reset.
 *  - Search kecil di pojok kanan atas → kamera fokus ke node match pertama.
 *  - Tombol reset → kamera balik ke fit awal + hapus fokus.
 *
 * ─── Warna & font canvas: resolve token di RUNTIME ───
 * Sigma gambar ke canvas/WebGL — string 'var(--x)' TIDAK di-resolve di situ.
 * Jadi token dibaca sekali via getComputedStyle pas mount (ikut tema aktif,
 * light/dark). KNOWN LIMIT: ganti tema saat graf lagi ke-mount gak me-recolor
 * canvas (butuh remount tab) — yang penting gak jadi panel putih nyala di dark.
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { useRouter } from 'next/navigation'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import { Maximize2, Search } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/context'

/** Instance Sigma dari useSigma — dipakai buat ref lintas SigmaContainer. */
type SigmaInstance = ReturnType<typeof useSigma>

/**
 * Palet canvas — nilai LITERAL hasil resolve token (bukan string var(--x)).
 * Fallback = nilai LIGHT theme di globals.css.
 */
interface CanvasPalette {
  mint: string
  ink: string
  investor: string
  surface: string
  edge: string
  edgeSoft: string
  font: string
}

const LIGHT_FALLBACK: CanvasPalette = {
  mint: '#17b890', // --c-mint (perusahaan)
  ink: '#18181b', // --ink (emiten aktif / label)
  investor: '#52525B', // --ink-soft (investor)
  surface: '#FFFFFF', // --surface (bg graf / halo node)
  edge: 'rgba(24, 24, 27, 0.11)', // --border (edge default)
  edgeSoft: 'rgba(24, 24, 27, 0.07)', // --border-soft (edge/node diredupin)
  font: 'system-ui, sans-serif',
}

/**
 * Baca token tema aktif SEKALI di client. labelFont sigma juga gak bisa
 * 'var(--font-sans)' (canvas 2D fillText → jatuh ke font default), jadi
 * fontFamily hasil computed body dipakai literal.
 */
function readCanvasPalette(): CanvasPalette {
  if (typeof document === 'undefined') return LIGHT_FALLBACK
  const root = getComputedStyle(document.documentElement)
  const pick = (token: string, fb: string) =>
    root.getPropertyValue(token).trim() || fb
  return {
    mint: pick('--c-mint', LIGHT_FALLBACK.mint),
    ink: pick('--ink', LIGHT_FALLBACK.ink),
    investor: pick('--ink-soft', LIGHT_FALLBACK.investor),
    surface: pick('--surface', LIGHT_FALLBACK.surface),
    edge: pick('--border', LIGHT_FALLBACK.edge),
    edgeSoft: pick('--border-soft', LIGHT_FALLBACK.edgeSoft),
    font: getComputedStyle(document.body).fontFamily || LIGHT_FALLBACK.font,
  }
}

/** Interaksi klik cuma di desktop (≥md) — mobile pertahanin perilaku lama. */
function isDesktopViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
}

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
function buildGraph(
  network: OwnershipNetwork,
  activeId: string | null,
  pal: CanvasPalette,
): Graph {
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
      color: isActive ? pal.ink : isCompany ? pal.mint : pal.investor,
      // Atribut custom buat ring highlight, tooltip, dan navigasi klik.
      kind: node.kind ?? 'investor',
      active: isActive,
      borderColor: isActive ? pal.ink : pal.surface,
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
      color: pal.edge,
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

/** Inner: expose instance Sigma ke parent (search/reset di luar SigmaContainer). */
function SigmaBridge({ sigmaRef }: { sigmaRef: MutableRefObject<SigmaInstance | null> }) {
  const sigma = useSigma()
  useEffect(() => {
    sigmaRef.current = sigma
    return () => {
      sigmaRef.current = null
    }
  }, [sigma, sigmaRef])
  return null
}

/**
 * Inner: mode fokus — pas ada node ke-select, tetangga di-highlight dan
 * node/edge lain diredupin lewat nodeReducer/edgeReducer (tanpa mutasi graph).
 */
function HighlightController({
  selected,
  palette,
}: {
  selected: string | null
  palette: CanvasPalette
}) {
  const sigma = useSigma()

  useEffect(() => {
    const g = sigma.getGraph()
    if (!selected || !g.hasNode(selected)) {
      sigma.setSetting('nodeReducer', null)
      sigma.setSetting('edgeReducer', null)
      sigma.refresh()
      return
    }

    const keep = new Set<string>(g.neighbors(selected))
    keep.add(selected)

    sigma.setSetting('nodeReducer', (node, data) => {
      if (node === selected) return { ...data, highlighted: true, zIndex: 2 }
      // Tetangga: tetap warna asli + label dipaksa muncul biar relasi kebaca.
      if (keep.has(node)) return { ...data, forceLabel: true, zIndex: 1 }
      // Sisanya: redup jadi hantu + label disembunyiin.
      return { ...data, color: palette.edgeSoft, label: '', zIndex: 0 }
    })
    sigma.setSetting('edgeReducer', (edge, data) => {
      const [s, t] = g.extremities(edge)
      if (s === selected || t === selected) {
        return { ...data, color: palette.mint, size: Math.max(1.5, (data.size as number) || 1), zIndex: 1 }
      }
      return { ...data, color: palette.edgeSoft, zIndex: 0 }
    })
    sigma.refresh()
  }, [selected, palette, sigma])

  return null
}

/** Inner: event handler — hover edge (tooltip) + klik node/stage + cursor affordance. */
function GraphEvents({
  palette,
  onHover,
  onNodeClick,
  onStageClick,
}: {
  palette: CanvasPalette
  onHover: (info: EdgeInfo | null, x: number, y: number) => void
  onNodeClick: (nodeId: string) => void
  onStageClick: () => void
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
        g.setEdgeAttribute(e.edge, 'color', palette.mint)
        g.setEdgeAttribute(e.edge, 'size', Math.max(2, g.getEdgeAttribute(e.edge, 'size') as number))
        sigma.refresh()
      },
      leaveEdge: (e) => {
        const g = sigma.getGraph()
        const pct = (g.getEdgeAttribute(e.edge, 'pct') as number | null) ?? 0
        g.setEdgeAttribute(e.edge, 'color', palette.edge)
        g.setEdgeAttribute(e.edge, 'size', Math.max(0.8, Math.min(6, pct / 12)))
        sigma.refresh()
        onHover(null, 0, 0)
      },
      // Affordance: cursor pointer nandain node bisa diklik (desktop only).
      enterNode: () => {
        if (isDesktopViewport()) sigma.getContainer().style.cursor = 'pointer'
      },
      leaveNode: () => {
        sigma.getContainer().style.cursor = ''
      },
      clickNode: (e) => onNodeClick(e.node),
      clickStage: () => onStageClick(),
    })
  }, [registerEvents, sigma, palette, onHover, onNodeClick, onStageClick])

  return null
}

export default function OwnershipGraph({ network, activeId }: GraphData) {
  const t = useT()
  const router = useRouter()
  const [tooltip, setTooltip] = useState<{ info: EdgeInfo; x: number; y: number } | null>(null)

  // Token tema di-resolve sekali pas mount (client-only via dynamic ssr:false).
  const [palette] = useState<CanvasPalette>(readCanvasPalette)

  // Node yang lagi difokusin (highlight tetangga) + state search.
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchMiss, setSearchMiss] = useState(false)
  const sigmaRef = useRef<SigmaInstance | null>(null)

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
  // STABIL dari props (server-fetched, gak di-recreate tiap render parent) +
  // palette (useState sekali, stabil), jadi ini gak re-run pas parent re-render.
  const graph = useMemo(() => buildGraph(network, activeId, palette), [network, activeId, palette])

  const handleHover = useCallback((info: EdgeInfo | null, x: number, y: number) => {
    if (info) setTooltip({ info, x, y })
    else setTooltip(null)
  }, [])

  // Klik node: perusahaan ber-ticker (bukan emiten yang lagi dibuka) → buka
  // halaman research-nya; selain itu (investor / emiten aktif) → toggle fokus.
  // Desktop only — mobile pertahanin perilaku lama (tap = no-op).
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (!isDesktopViewport()) return
      const g = sigmaRef.current?.getGraph()
      if (!g?.hasNode(nodeId)) return
      const kind = g.getNodeAttribute(nodeId, 'kind') as string
      const symbol = (g.getNodeAttribute(nodeId, 'symbol') as string) || ''
      if (kind === 'company' && symbol && nodeId !== activeId) {
        router.push(`/dashboard/assets/investment/stock/research/${encodeURIComponent(symbol)}`)
        return
      }
      setSelected((prev) => (prev === nodeId ? null : nodeId))
    },
    [activeId, router],
  )

  const handleStageClick = useCallback(() => setSelected(null), [])

  // Search: cari node by ticker (prefix) dulu, fallback nama (substring),
  // terus fokusin kamera + highlight tetangganya.
  const focusSearch = useCallback(() => {
    const sigma = sigmaRef.current
    const q = search.trim().toUpperCase()
    if (!sigma || !q) return
    const g = sigma.getGraph()
    let bySymbol: string | null = null
    let byName: string | null = null
    g.forEachNode((id, attr) => {
      const sym = String(attr.symbol ?? '').toUpperCase()
      const name = String(attr.fullName ?? attr.label ?? '').toUpperCase()
      if (!bySymbol && sym && sym.startsWith(q)) bySymbol = id
      if (!byName && name.includes(q)) byName = id
    })
    const target = bySymbol ?? byName
    if (!target) {
      setSearchMiss(true)
      return
    }
    setSearchMiss(false)
    setSelected(target)
    const d = sigma.getNodeDisplayData(target)
    if (d) sigma.getCamera().animate({ x: d.x, y: d.y, ratio: 0.4 }, { duration: 300 })
  }, [search])

  // Reset: hapus fokus + kamera balik fit awal.
  const resetView = useCallback(() => {
    setSelected(null)
    setSearch('')
    setSearchMiss(false)
    sigmaRef.current?.getCamera().animatedReset({ duration: 150 })
  }, [])

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
            // Container = DOM biasa → CSS var aman di sini (ikut tema);
            // warna CANVAS (node/label/edge) tetap dari palette runtime.
            background: 'var(--surface)',
          }}
          settings={{
            labelColor: { color: palette.ink },
            labelSize: 12,
            labelWeight: '600',
            // labelFont HARUS font-family literal — canvas fillText gak
            // nge-resolve 'var(--font-sans)' (jatuh ke font default browser).
            labelFont: palette.font,
            defaultEdgeType: 'arrow',
            renderEdgeLabels: false,
            zIndex: true,
            minCameraRatio: 0.2,
            maxCameraRatio: 4,
          }}
        >
          <SigmaBridge sigmaRef={sigmaRef} />
          <FitCamera />
          <HighlightController selected={selected} palette={palette} />
          <GraphEvents
            palette={palette}
            onHover={handleHover}
            onNodeClick={handleNodeClick}
            onStageClick={handleStageClick}
          />
        </SigmaContainer>
      ) : (
        // Placeholder dengan dimensi yang sama biar IO langsung lihat tinggi >0.
        <div
          className="flex items-center justify-center rounded-xl text-xs"
          style={{
            height: GRAPH_HEIGHT,
            width: '100%',
            background: 'var(--surface)',
            color: 'var(--ink-soft)',
          }}
        >
          {t('ownership_graph.preparing')}
        </div>
      )}

      {/* Kontrol eksplorasi: search node + reset tampilan (desktop only) */}
      <div className="absolute top-3 right-3 z-10 hidden md:flex items-start gap-1.5">
        <div className="relative">
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5"
            style={{ color: 'var(--ink-soft)' }}
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSearchMiss(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') focusSearch()
              if (e.key === 'Escape') resetView()
            }}
            placeholder="Cari nama / ticker…"
            aria-label="Cari node di graf kepemilikan"
            className="h-8 w-44 pl-7 pr-2 text-xs rounded-lg border outline-none transition-colors duration-150 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            style={{
              background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
              backdropFilter: 'blur(4px)',
              borderColor: 'var(--border-soft)',
              color: 'var(--ink)',
            }}
          />
          {searchMiss && (
            <p
              className="absolute left-0 top-full mt-1 rounded-md border px-2 py-1 text-[11px]"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border-soft)',
                color: 'var(--ink-soft)',
              }}
            >
              Tidak ketemu di graf ini
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={resetView}
          title="Reset tampilan"
          aria-label="Reset tampilan graf"
          style={{
            background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
            backdropFilter: 'blur(4px)',
            border: '1px solid var(--border-soft)',
            color: 'var(--ink-muted)',
          }}
        >
          <Maximize2 />
        </Button>
      </div>

      {/* Legend */}
      <div
        className="absolute top-3 left-3 flex items-center gap-3 rounded-lg border px-3 py-1.5 text-[11px]"
        style={{
          background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
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
          <span className="inline-block size-2.5 rounded-full" style={{ background: 'var(--ink-soft)' }} />
          {t('ownership_graph.investor')}
        </span>
        {/* Affordance klik — desktop only, sejalan sama interaksinya */}
        <span className="hidden md:inline" style={{ color: 'var(--ink-soft)' }}>
          · klik node buat telusuri
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
