/**
 * RingProgress — ring SVG kecil buat momen visual F10 (ala "HARI 13" Budggt).
 * Murni presentasi: track abu + arc warna, opsional label di tengah.
 * pct di-clamp 0..100; warna default teal brand, kirim `color` buat override
 * (mis. coral pas lewat tenggat / over budget).
 */

interface RingProgressProps {
  pct: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  /** label utama di tengah (mis. "34%") — kosongkan buat ring polos */
  label?: string
  /** sub-label kecil di bawah label utama (butuh size ≥ 64) */
  subLabel?: string
  className?: string
}

export function RingProgress({
  pct,
  size = 36,
  strokeWidth = 4,
  color = 'var(--c-mint)',
  trackColor = 'var(--surface-2)',
  label,
  subLabel,
  className,
}: RingProgressProps) {
  const clamped = Math.max(0, Math.min(100, pct))
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const arc = (clamped / 100) * c
  const center = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={label ? `${label}${subLabel ? ` ${subLabel}` : ''}` : `${Math.round(clamped)}%`}
    >
      <circle cx={center} cy={center} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      {arc > 0 && (
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      )}
      {label && (
        <text
          x={center}
          y={subLabel ? center - 2 : center}
          textAnchor="middle"
          dominantBaseline="central"
          className="num"
          style={{ fontSize: size >= 64 ? 15 : 10.5, fontWeight: 600, fill: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
        >
          {label}
        </text>
      )}
      {label && subLabel && size >= 64 && (
        <text
          x={center}
          y={center + 12}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: 9.5, fill: 'var(--ink-soft)' }}
        >
          {subLabel}
        </text>
      )}
    </svg>
  )
}
