'use client'

import * as React from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import { Info } from 'lucide-react'

/**
 * InfoTip — a reliable ⓘ tooltip. Uses base-ui Tooltip which PORTALS to the body,
 * so it shows on hover/focus and is never clipped by an overflow-hidden card
 * (the failure mode of the previous native-title / CSS group-hover tooltips).
 */
export function InfoTip({ text }: { text: React.ReactNode }) {
  return (
    <Tooltip.Provider delay={120} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          className="inline-flex cursor-help items-center align-middle outline-none"
          aria-label="Info"
        >
          <Info className="size-3.5" style={{ color: 'var(--ink-soft)' }} />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="bottom" align="start" sideOffset={6} className="z-[60]">
            <Tooltip.Popup
              className="max-w-[280px] rounded-lg px-2.5 py-1.5 text-[11px] leading-snug shadow-lg outline-none"
              style={{ background: 'var(--ink)', color: 'var(--surface)' }}
            >
              {text}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
