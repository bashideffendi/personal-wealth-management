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

/** Returns the household record the current user belongs to, or null. */
export async function fetchActiveHousehold(supabase: DB, userId: string): Promise<Household | null> {
  const memberRes = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!memberRes.data) return null

  const hhRes = await supabase
    .from('households')
    .select('*')
    .eq('id', (memberRes.data as { household_id: string }).household_id)
    .maybeSingle()

  return (hhRes.data ?? null) as Household | null
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

/** Indonesian label for a relationship code (or null). */
export function relationshipLabel(rel?: string | null): string | null {
  if (!rel) return null
  const map: Record<string, string> = { pasangan: 'Pasangan', orang_tua: 'Orang tua', anak: 'Anak', saudara: 'Saudara', lainnya: 'Lainnya' }
  return map[rel] ?? null
}

/** Shared (household-tagged) goals for the family page. */
export async function fetchHouseholdGoals(supabase: DB, householdId: string): Promise<HouseholdGoal[]> {
  const res = await supabase
    .from('goals')
    .select('id, name, category, target_amount, current_amount, deadline, household_id')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return (res.data ?? []) as HouseholdGoal[]
}

/** Recent household activity feed (joined with profiles for actor name). */
export async function fetchHouseholdActivities(supabase: DB, householdId: string, limit = 12): Promise<HouseholdActivity[]> {
  const res = await supabase
    .from('household_activities')
    .select('id, household_id, user_id, action, description, created_at, profiles!inner(full_name)')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(limit)
  type Row = {
    id: string; household_id: string; user_id: string; action: string
    description: string | null; created_at: string; profiles: { full_name: string | null } | null
  }
  return ((res.data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, household_id: r.household_id, user_id: r.user_id, action: r.action,
    description: r.description, created_at: r.created_at, full_name: r.profiles?.full_name ?? null,
  }))
}

/** Log a household activity (RLS: only as self, in own household). Best-effort. */
export async function logActivity(supabase: DB, householdId: string, userId: string, action: string, description: string): Promise<void> {
  await supabase.from('household_activities').insert({ household_id: householdId, user_id: userId, action, description })
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
