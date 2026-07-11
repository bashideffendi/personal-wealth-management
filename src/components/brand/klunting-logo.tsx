/**
 * Logo Klunting ASLI — mark 4 kotak plus-layout (teal/coral/biru/ungu) +
 * wordmark "klunting" lowercase 800. Geometri identik public/icon.svg.
 *
 * Dipakai menggantikan tile "K" generik (kotak ink berhuruf K) yang selama ini
 * nempel di landing/marketing/auth/app — feedback user 2026-07-11: "logo kok
 * masih AI yang kerjakan, padahal kita sudah punya logo; elemen warnanya tidak
 * dimainkan". Server component, tanpa dependency.
 *
 * Warna mark sengaja HEX literal (identitas brand, sama di light/dark —
 * preseden icon.tsx/opengraph-image); wordmark ikut token var(--ink).
 */

const MARK_TILES = [
  { c: '#17b890', x: 35, y: 3 },  // atas — teal
  { c: '#f0664f', x: 3, y: 35 },  // kiri — coral
  { c: '#5d6fe0', x: 67, y: 35 }, // kanan — biru
  { c: '#8b4fb0', x: 35, y: 67 }, // bawah — ungu
]

export function KluntingMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {MARK_TILES.map((t) => (
        <rect key={t.c} x={t.x} y={t.y} width={30} height={30} rx={9} fill={t.c} />
      ))}
    </svg>
  )
}

/**
 * Lockup mark + wordmark. TANPA <Link> — pembungkusnya yang menautkan
 * (tiap pemakai punya href/aria sendiri).
 */
export function KluntingLogo({
  size = 26,
  wordmarkSize,
  className,
}: {
  /** Tinggi mark (px). */
  size?: number
  /** Ukuran font wordmark — default proporsional mark. */
  wordmarkSize?: number
  className?: string
}) {
  const fs = wordmarkSize ?? Math.round(size * 0.78)
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <KluntingMark size={size} />
      <span
        style={{
          fontWeight: 800,
          fontSize: fs,
          letterSpacing: '-0.04em',
          color: 'var(--ink)',
          lineHeight: 1,
        }}
      >
        klunting
      </span>
    </span>
  )
}
