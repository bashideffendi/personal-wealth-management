/**
 * Household sharing helpers.
 *
 * MVP scope: each user is in AT MOST ONE household. The active household
 * (if any) determines which household_id new transactions/accounts/budgets
 * are tagged with. Without a household, behavior is unchanged (personal mode).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface Household {
  id: string
  name: string
  owner_user_id: string
  max_seats: number
  created_at: string
}

export interface HouseholdMember {
  household_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
  can_edit?: boolean
  relationship?: string | null
  share_net_worth?: boolean
}

export interface MemberWithProfile extends HouseholdMember {
  full_name: string | null
  email: string | null
}

export interface HouseholdActivity {
  id: string
  household_id: string
  user_id: string
  action: string
  description: string | null
  created_at: string
  full_name?: string | null
}

export interface HouseholdGoal {
  id: string
  name: string
  category: string
  target_amount: number
  current_amount: number
  deadline: string | null
  household_id: string | null
}

export interface HouseholdNetWorth {
  success: boolean
  combined_net_worth?: number
  combined_assets?: number
  combined_debts?: number
  members_sharing?: number
  members_total?: number
  as_of?: string | null
  error?: string
}

export interface HouseholdInvitation {
  id: string
  household_id: string
  invited_by: string
  email: string | null
  token: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, any, any>

/** Returns the household record the current user belongs to, or null.
 *  Satu query embed (FK household_members.household_id → households ada,
 *  diverifikasi resolve di prod) — hemat 1 RTT di kepala waterfall halaman. */
export async function fetchActiveHousehold(supabase: DB, userId: string): Promise<Household | null> {
  const res = await supabase
    .from('household_members')
    .select('household_id, households(*)')
    .eq('user_id', userId)
    .maybeSingle()
  if (res.error) throw res.error
  return ((res.data as { households: Household | null } | null)?.households ?? null)
}

/** Nama anggota household via RPC 049 (kolom terbatas, sesama anggota saja).
 *  PENTING: jangan embed `profiles!inner` dari household_members/activities —
 *  gak ada FK ke profiles (user_id → auth.users) = PGRST200 fatal di prod.
 *  Best-effort: RPC belum di-run → balikin map kosong, UI fallback "Anggota". */
export async function fetchHouseholdDirectory(supabase: DB, householdId: string): Promise<Map<string, string | null>> {
  const { data, error } = await supabase.rpc('get_household_directory', { hh_id: householdId })
  if (error) {
    console.error('[household] directory RPC gagal (migration 049 belum jalan?):', error.message)
    return new Map()
  }
  const rows = (data ?? []) as { user_id: string; full_name: string | null }[]
  return new Map(rows.map((r) => [r.user_id, r.full_name]))
}

/** Generates a URL-safe random token for invitations. */
export function generateInviteToken(length = 24): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars (no 0/O/1/I/l)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(length)
    crypto.getRandomValues(buf)
    return Array.from(buf, (b) => chars[b % chars.length]).join('')
  }
  let s = ''
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

/** Returns true if user owns the household. */
export function isOwner(household: Household | null, userId: string): boolean {
  return !!household && household.owner_user_id === userId
}


/** Shared (household-tagged) goals for the family page. */
export async function fetchHouseholdGoals(supabase: DB, householdId: string): Promise<HouseholdGoal[]> {
  const res = await supabase
    .from('goals')
    .select('id, name, category, target_amount, current_amount, deadline, household_id')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (res.error) throw res.error
  return (res.data ?? []) as HouseholdGoal[]
}

/** Recent household activity feed. Nama aktor di-merge caller dari
 *  fetchHouseholdDirectory — TANPA embed profiles (lihat catatan di atas). */
export async function fetchHouseholdActivities(supabase: DB, householdId: string, limit = 12): Promise<HouseholdActivity[]> {
  const res = await supabase
    .from('household_activities')
    .select('id, household_id, user_id, action, description, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (res.error) throw res.error
  return (res.data ?? []) as HouseholdActivity[]
}

/** Log a household activity (RLS: only as self, in own household). Best-effort. */
export async function logActivity(supabase: DB, householdId: string, userId: string, action: string, description: string): Promise<string | null> {
  const { data } = await supabase.from('household_activities').insert({ household_id: householdId, user_id: userId, action, description }).select('id').single()
  return (data as { id: string } | null)?.id ?? null
}

/** Combined household net worth via SECURITY DEFINER RPC (aggregate only). */
export async function getHouseholdNetWorth(supabase: DB, householdId: string): Promise<HouseholdNetWorth> {
  const { data, error } = await supabase.rpc('get_household_net_worth', { hh_id: householdId })
  if (error || !data) return { success: false, error: error?.message ?? 'gagal' }
  return data as HouseholdNetWorth
}

/** Toggle the current user's own net-worth-sharing flag (self only, via RPC). */
export async function setMyNetWorthSharing(supabase: DB, share: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('set_my_net_worth_sharing', { share })
  return !error
}
