/**
 * Vignette UI landing — komposisi produk mini yang DIBANGUN dengan token
 * design-system (bukan screenshot), supaya: tajam di retina, ikut dark mode,
 * dan selalu mencerminkan bahasa visual produk TERKINI. Data contoh statis.
 * Server components, nol dependency, nol motion (restraint).
 */

// ─── Catat dengan AI: ketik bahasa biasa → transaksi jadi ─────────────────
export function AiEntryVignette() {
  return (
    <div className="w-full max-w-md mx-auto select-none" aria-hidden="true">
      {/* input yang diketik user */}
      <div
        className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}
      >
        <span className="size-2 rounded-full shrink-0" style={{ background: 'var(--c-coral)' }} />
        <span className="text-[15px]" style={{ color: 'var(--ink)' }}>
          kopi 25rb pake gopay
          <span className="inline-block w-[2px] h-[1.05em] align-middle ml-0.5" style={{ background: 'var(--ink)', opacity: 0.7 }} />
        </span>
        <span
          className="ml-auto text-[10px] font-bold tracking-[0.12em] uppercase px-1.5 py-0.5 rounded shrink-0"
          style={{ background: 'var(--c-coral-soft)', color: 'var(--c-coral-ink)' }}
        >
          AI
        </span>
      </div>

      {/* garis proses */}
      <div className="flex justify-center py-2.5">
        <div className="w-px h-5" style={{ background: 'var(--line-strong)' }} />
      </div>

      {/* hasil: baris transaksi jadi */}
      <div
        className="rounded-xl border px-4 py-3.5 flex items-center gap-3.5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}
      >
        <div className="size-9 rounded-lg grid place-items-center shrink-0" style={{ background: 'var(--c-coral-soft)' }}>
          <span className="text-[15px] font-bold" style={{ color: 'var(--c-coral-ink)' }}>K</span>
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>Kopi</p>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>Makanan &amp; Minuman · GoPay · hari ini</p>
        </div>
        <p className="ml-auto num tabular text-[15px] font-bold shrink-0" style={{ color: 'var(--ink)' }}>−Rp 25.000</p>
      </div>

      <p className="text-center text-[11px] mt-3" style={{ color: 'var(--ink-soft)' }}>
        Tiga detik. Tanpa form, tanpa dropdown.
      </p>
    </div>
  )
}

// ─── Anggaran grid 12 bulan: rasa spreadsheet ─────────────────────────────
const BUDGET_ROWS = [
  { cat: 'Makanan', v: ['2.500', '2.500', '2.750'] },
  { cat: 'Transport', v: ['900', '900', '900'] },
  { cat: 'Tagihan', v: ['1.450', '1.450', '1.450'] },
  { cat: 'Hiburan', v: ['600', '750', '600'] },
]

export function BudgetVignette() {
  return (
    <div
      className="w-full max-w-md mx-auto rounded-xl border overflow-hidden select-none"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}
      aria-hidden="true"
    >
      <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            {['Kategori', 'Jan', 'Feb', 'Mar'].map((h, i) => (
              <th
                key={h}
                className={`px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] ${i === 0 ? 'text-left' : 'text-right'}`}
                style={{ color: 'var(--ink-soft)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BUDGET_ROWS.map((r, ri) => (
            <tr key={r.cat} className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <td className="px-3.5 py-2.5 font-medium" style={{ color: 'var(--ink)' }}>{r.cat}</td>
              {r.v.map((v, ci) => {
                const active = ri === 0 && ci === 2
                return (
                  <td key={ci} className="px-3.5 py-2.5 text-right num tabular relative" style={{ color: 'var(--ink-muted)' }}>
                    {active ? (
                      <span
                        className="relative inline-block px-1.5 py-0.5 rounded"
                        style={{ boxShadow: 'inset 0 0 0 1.5px var(--c-violet)', color: 'var(--ink)' }}
                      >
                        {v}
                        {/* handle drag-fill khas spreadsheet */}
                        <span className="absolute -bottom-1 -right-1 size-1.5 rounded-[2px]" style={{ background: 'var(--c-violet)' }} />
                      </span>
                    ) : v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3.5 py-2 text-[11px] border-t" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
        Tarik handle-nya — nilai terisi ke bulan berikutnya.
      </p>
    </div>
  )
}

// ─── Keyboard-first: tuts nyata ───────────────────────────────────────────
function Key({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-lg border text-[13px] font-semibold ${wide ? 'px-3 h-10' : 'size-10'}`}
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        borderBottomWidth: 3,
        color: 'var(--ink)',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      {children}
    </span>
  )
}

export function KeyboardVignette() {
  return (
    <div className="w-full max-w-md mx-auto select-none" aria-hidden="true">
      <div className="flex flex-wrap items-center gap-2.5 justify-center">
        <Key wide>⌘</Key>
        <Key>K</Key>
        <span className="mx-1 text-[13px]" style={{ color: 'var(--ink-soft)' }}>lompat ke mana pun</span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 justify-center mt-3">
        <Key>N</Key>
        <span className="text-[13px] mr-2" style={{ color: 'var(--ink-soft)' }}>transaksi baru</span>
        <Key>J</Key>
        <Key>K</Key>
        <span className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>telusuri baris</span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 justify-center mt-3">
        <Key wide>Space</Key>
        <span className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>intip detail tanpa pindah halaman</span>
      </div>
    </div>
  )
}
