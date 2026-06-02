'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  loadTree,
  loadLocalTree,
  categoryOptions,
  type CategoryOption,
  type CategoryTree,
  type BudgetType,
} from '@/lib/budget-categories'
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  SAVING_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from '@/lib/constants'

const CONSTANT_FALLBACK: Record<BudgetType, readonly string[]> = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
  saving: SAVING_CATEGORIES,
  investment: INVESTMENT_CATEGORIES,
}

function fallbackOptions(type: BudgetType): CategoryOption[] {
  return CONSTANT_FALLBACK[type].map((name) => ({ value: name, label: name, depth: 0 }))
}

/**
 * Satu sumber kebenaran kategori buat SEMUA picker (form transaksi, quick-add,
 * rules). Load tree user sekali, balikin opsi (induk + subkategori "Induk › Sub").
 * Selama tree belum kebaca, fallback ke daftar konstanta biar dropdown gak kosong.
 */
export function useCategoryOptions() {
  const [tree, setTree] = useState<CategoryTree | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        setTree(loadLocalTree())
        return
      }
      const { tree: t } = await loadTree(supabase, user.id)
      if (active) setTree(t)
    })()
    return () => {
      active = false
    }
  }, [])

  function optionsForType(type: BudgetType): CategoryOption[] {
    const nodes = tree?.[type]
    if (!nodes || !nodes.length) return fallbackOptions(type)
    const opts = categoryOptions(nodes)
    return opts.length ? opts : fallbackOptions(type)
  }

  function firstOf(type: BudgetType): string {
    return optionsForType(type)[0]?.value ?? ''
  }

  return { tree, optionsForType, firstOf, ready: tree !== null }
}
