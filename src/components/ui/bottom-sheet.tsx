'use client'

/**
 * BottomSheet — mobile sheet yang naik dari bawah (di atas base-ui Sheet).
 * Grab-handle + rounded-top + scroll overscroll-contain + safe-area inset.
 * Dipakai buat MoreSheet (nav "Lainnya"), filter, picker, dll. Title WAJIB
 * (a11y aria-labelledby) — kalau gak mau keliatan, set `hideTitle`.
 */

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  children,
  className,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  hideTitle?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn('border-0 p-0 gap-0', className)}
        style={{
          background: 'var(--surface)',
          maxHeight: '88dvh',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-2.5 pb-1.5 shrink-0">
          <span
            className="h-1 w-9 rounded-full"
            style={{ background: 'var(--border-strong, rgba(24,24,27,0.18))' }}
            aria-hidden
          />
        </div>

        <div className={cn('px-4', hideTitle ? 'sr-only' : 'pb-2 shrink-0')}>
          <SheetTitle
            className="text-[17px] font-semibold leading-tight"
            style={{ color: 'var(--ink)' }}
          >
            {title}
          </SheetTitle>
          {description && (
            <SheetDescription
              className="text-[13px] mt-0.5"
              style={{ color: 'var(--ink-soft)' }}
            >
              {description}
            </SheetDescription>
          )}
        </div>

        <div
          className="overflow-y-auto overscroll-contain px-3"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
