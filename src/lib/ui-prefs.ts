/**
 * UI prefs (custom dashboard/report show-hide) — durable mirror di
 * profiles.ui_prefs (JSONB). localStorage tetap sumber instant; ini biar
 * preferensi lintas-perangkat & tahan cache clear.
 *
 * Semua best-effort + resilient: kalau kolom ui_prefs belum ada (sebelum
 * migrasi 040) atau user belum login, fungsi diam-diam no-op / return null,
 * dan fitur tetap jalan pakai localStorage.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface UiPrefs {
  dashboardHidden: string[]
  reportHidden: string[]
  dashboardOrder: string[]
}

export async function loadUiPrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<Partial<UiPrefs> | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('ui_prefs')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return null
    const p = (data as { ui_prefs: unknown }).ui_prefs
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as Partial<UiPrefs>) : null
  } catch {
    return null
  }
}

/** Merge-patch ui_prefs (read current → merge → update). Single-user, no race concern. */
export async function saveUiPref(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<UiPrefs>,
): Promise<void> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('ui_prefs')
      .eq('id', userId)
      .maybeSingle()
    const cur = ((data as { ui_prefs?: unknown } | null)?.ui_prefs ?? {}) as Partial<UiPrefs>
    const merged = (cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : {}) as Partial<UiPrefs>
    await supabase.from('profiles').update({ ui_prefs: { ...merged, ...patch } }).eq('id', userId)
  } catch {
    /* ignore — localStorage tetap jadi fallback */
  }
}
