'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n/context'

const CONFIRM_WORD = 'HAPUS'

export function DeleteAccountButton() {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch('/api/delete-account', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || t('profile.delete_failed'))
        return
      }
      toast.success(t('profile.delete_done'))
      // Session is already signed out server-side; go to the public landing.
      router.push('/')
      router.refresh()
    } catch {
      toast.error(t('profile.delete_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => { setConfirm(''); setOpen(true) }}
        style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}
      >
        <Trash2 className="size-4" /> {t('profile.delete_account')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className="size-10 rounded-xl grid place-items-center shrink-0"
                style={{ background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' }}
              >
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle>{t('profile.delete_title')}</DialogTitle>
                <DialogDescription>{t('profile.delete_desc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              {t('profile.delete_confirm_prompt')} <strong style={{ color: 'var(--ink)' }}>{CONFIRM_WORD}</strong>
            </p>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && confirm === CONFIRM_WORD && !loading) handleDelete() }}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('profile.delete_cancel')}</Button>
            <Button
              onClick={handleDelete}
              disabled={loading || confirm !== CONFIRM_WORD}
              style={{ background: 'var(--danger)', color: '#fff', border: 0 }}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t('profile.delete_permanent')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
