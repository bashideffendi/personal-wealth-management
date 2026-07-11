/**
 * HeroChart — ornamen sparkline kecil di hero landing yang meminjam bahasa
 * visual auth shell ((auth)/layout.tsx): satu garis net-worth presisi yang
 * menggambar diri SEKALI saat load. Bentuk kurva = versi mini kurva auth.
 * CSS-only (tanpa JS, tetap server component / prerenderable);
 * prefers-reduced-motion: reduce → garis langsung tergambar penuh, tanpa
 * animasi. Dekoratif murni (aria-hidden).
 */

export function HeroChart({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <style>{`
        @keyframes lpDraw { to { stroke-dashoffset: 0 } }
        @keyframes lpDot { to { opacity: 1 } }
        .lp-draw { animation: lpDraw 1.4s ease-out 0.2s forwards }
        .lp-dot  { opacity: 0; animation: lpDot 0.3s ease-out 1.5s forwards }
        @media (prefers-reduced-motion: reduce) {
          .lp-draw { animation: none !important; stroke-dashoffset: 0 !important }
          .lp-dot  { animation: none !important; opacity: 1 !important }
        }
      `}</style>
      <svg width="152" height="32" viewBox="0 0 152 32" fill="none">
        <polyline
          className="lp-draw"
          points="2,28 16,25.8 32,27.1 48,21.4 64,23.3 80,17.4 96,19.2 112,12.4 128,7.9 144,4"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="200"
          strokeDashoffset="200"
        />
        <circle className="lp-dot" cx="144" cy="4" r="3" fill="var(--accent)" />
      </svg>
    </div>
  )
}
