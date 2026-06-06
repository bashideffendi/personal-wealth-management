'use client'

import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/context'

/**
 * UU PDP data-export trigger. Drop into the profile / settings page:
 *   import { ExportDataButton } from '@/components/export-data-button'
 *   <ExportDataButton />
 * Hits GET /api/export-data (RLS-scoped to the user) and downloads the JSON.
 */
export function ExportDataButton() {
  const t = useT()
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch('/api/export-data')
      if (!res.ok) throw new Error(t('export_data.errorRetry'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'klunting-data-export.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t('export_data.success'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('export_data.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {t('export_data.button')}
    </Button>
  )
}
