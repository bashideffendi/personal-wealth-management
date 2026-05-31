'use client'

/**
 * Search lompat-saham buat halaman research (server component).
 * Wrapper tipis di atas StockTickerSearch: pas user milih ticker, langsung
 * router.push ke halaman research saham tsb. Compact + unobtrusive, dipasang
 * di header kartu ringkasan.
 */

import { useRouter } from 'next/navigation'
import { StockTickerSearch } from './stock-ticker-search'

export function ResearchStockSearch() {
  const router = useRouter()
  return (
    <StockTickerSearch
      placeholder="Cari saham lain…"
      onSelect={(s) =>
        router.push(`/dashboard/assets/investment/stock/research/${s.t}`)
      }
    />
  )
}
