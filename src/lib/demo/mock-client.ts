/**
 * Minimal Supabase-compatible mock client for demo mode.
 * Supports the subset of the builder API used in this app:
 *   .from(table).select(...).eq(...).in(...).gte(...).lt(...).order(...).limit(n)
 *   .from(table).insert(row | rows)
 *   .from(table).update(payload).eq('id', id)
 *   .from(table).delete().eq('id', id)
 *   .from(table).upsert(rows, { onConflict })
 *   .from(table)... .maybeSingle() / .single()
 *   .auth.getUser(), .auth.signOut(), .auth.signInWithPassword(), .auth.signUp()
 *
 * The builder is a thenable so `await supabase.from(...).select().eq(...)`
 * resolves to { data, error }.
 */

import { demoStore, DEMO_USER } from './fixtures'

type Row = Record<string, unknown>
type Filter =
  | { op: 'eq'; col: string; val: unknown }
  | { op: 'in'; col: string; val: unknown[] }
  | { op: 'gte'; col: string; val: unknown }
  | { op: 'lt'; col: string; val: unknown }
  | { op: 'neq'; col: string; val: unknown }

let seq = 10_000
function nextId() {
  seq += 1
  return `demo-${seq.toString(36)}`
}

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return filters.reduce((acc, f) => {
    switch (f.op) {
      case 'eq':
        return acc.filter((r) => r[f.col] === f.val)
      case 'neq':
        return acc.filter((r) => r[f.col] !== f.val)
      case 'in':
        return acc.filter((r) => (f.val as unknown[]).includes(r[f.col]))
      case 'gte':
        return acc.filter((r) => {
          const v = r[f.col]
          if (v == null) return false
          return (v as string | number) >= (f.val as string | number)
        })
      case 'lt':
        return acc.filter((r) => {
          const v = r[f.col]
          if (v == null) return false
          return (v as string | number) < (f.val as string | number)
        })
    }
  }, rows)
}

function tableRows(table: string): Row[] {
  if (!demoStore[table]) demoStore[table] = []
  return demoStore[table] as Row[]
}

type Mode =
  | { kind: 'select' }
  | { kind: 'insert'; payload: Row | Row[] }
  | { kind: 'update'; payload: Row }
  | { kind: 'delete' }
  | { kind: 'upsert'; payload: Row | Row[]; onConflict?: string }

interface BuilderState {
  table: string
  mode: Mode
  filters: Filter[]
  orderCol?: string
  orderAsc: boolean
  limitN?: number
}

function terminalResult(state: BuilderState): { data: Row[] | Row | null; error: null } {
  const rows = tableRows(state.table)

  if (state.mode.kind === 'select') {
    let out = applyFilters(rows, state.filters)
    if (state.orderCol) {
      const col = state.orderCol
      out = [...out].sort((a, b) => {
        const x = a[col] as string | number
        const y = b[col] as string | number
        if (x == null && y == null) return 0
        if (x == null) return 1
        if (y == null) return -1
        if (x === y) return 0
        return (x > y ? 1 : -1) * (state.orderAsc ? 1 : -1)
      })
    }
    if (state.limitN != null) out = out.slice(0, state.limitN)
    return { data: out, error: null }
  }

  if (state.mode.kind === 'insert') {
    const arr = Array.isArray(state.mode.payload)
      ? state.mode.payload
      : [state.mode.payload]
    const inserted = arr.map((p) => ({ id: p.id ?? nextId(), created_at: new Date().toISOString(), ...p }))
    rows.push(...inserted)
    return { data: inserted, error: null }
  }

  if (state.mode.kind === 'update') {
    const matched = applyFilters(rows, state.filters)
    for (const m of matched) Object.assign(m, state.mode.payload)
    return { data: matched, error: null }
  }

  if (state.mode.kind === 'delete') {
    const matched = new Set(applyFilters(rows, state.filters))
    demoStore[state.table] = rows.filter((r) => !matched.has(r))
    return { data: null, error: null }
  }

  if (state.mode.kind === 'upsert') {
    const arr = Array.isArray(state.mode.payload)
      ? state.mode.payload
      : [state.mode.payload]
    // onConflict can be COMPOSITE ("user_id,snapshot_date") — match every key.
    // The old single-key lookup made r[key] === p[key] compare undefined ===
    // undefined and silently overwrite the FIRST row on every composite upsert.
    const keys = (state.mode.onConflict ?? 'id').split(',').map((k) => k.trim())
    for (const p of arr) {
      const hasAny = keys.some((k) => p[k] !== undefined)
      const idx = hasAny ? rows.findIndex((r) => keys.every((k) => r[k] === p[k])) : -1
      if (idx >= 0) Object.assign(rows[idx], p)
      else rows.push({ id: p.id ?? nextId(), ...p })
    }
    return { data: arr, error: null }
  }

  return { data: null, error: null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Builder extends PromiseLike<{ data: any; error: null }> {
  select: (_cols?: string, _opts?: unknown) => Builder
  eq: (col: string, val: unknown) => Builder
  neq: (col: string, val: unknown) => Builder
  in: (col: string, val: unknown[]) => Builder
  gte: (col: string, val: unknown) => Builder
  lt: (col: string, val: unknown) => Builder
  order: (col: string, opts?: { ascending?: boolean }) => Builder
  limit: (n: number) => Builder
  insert: (payload: Row | Row[]) => Builder
  update: (payload: Row) => Builder
  delete: () => Builder
  upsert: (payload: Row | Row[], opts?: { onConflict?: string }) => Builder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeSingle: () => Promise<{ data: any; error: null }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  single: () => Promise<{ data: any; error: null }>
}

function makeBuilder(table: string): Builder {
  const state: BuilderState = {
    table,
    mode: { kind: 'select' },
    filters: [],
    orderAsc: true,
  }

  const terminal = () => {
    const res = terminalResult(state)
    return res
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    select: (_cols?: string) => {
      if (state.mode.kind === 'select' || state.mode.kind === 'delete') {
        // just a selector hint
      }
      return builder
    },
    eq: (col: string, val: unknown) => {
      state.filters.push({ op: 'eq', col, val })
      return builder
    },
    neq: (col: string, val: unknown) => {
      state.filters.push({ op: 'neq', col, val })
      return builder
    },
    in: (col: string, val: unknown[]) => {
      state.filters.push({ op: 'in', col, val })
      return builder
    },
    gte: (col: string, val: unknown) => {
      state.filters.push({ op: 'gte', col, val })
      return builder
    },
    lt: (col: string, val: unknown) => {
      state.filters.push({ op: 'lt', col, val })
      return builder
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      state.orderCol = col
      state.orderAsc = opts?.ascending !== false
      return builder
    },
    limit: (n: number) => {
      state.limitN = n
      return builder
    },
    insert: (payload: Row | Row[]) => {
      state.mode = { kind: 'insert', payload }
      return builder
    },
    update: (payload: Row) => {
      state.mode = { kind: 'update', payload }
      return builder
    },
    delete: () => {
      state.mode = { kind: 'delete' }
      return builder
    },
    upsert: (payload: Row | Row[], opts?: { onConflict?: string }) => {
      state.mode = { kind: 'upsert', payload, onConflict: opts?.onConflict }
      return builder
    },
    maybeSingle: async () => {
      const { data } = terminal() as { data: Row[] | Row | null }
      const first = Array.isArray(data) ? data[0] ?? null : data ?? null
      return { data: first, error: null }
    },
    single: async () => {
      const { data } = terminal() as { data: Row[] | Row | null }
      const first = Array.isArray(data) ? data[0] ?? null : data ?? null
      return { data: first, error: null }
    },
    then: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve: (v: any) => unknown,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reject?: (e: unknown) => any
    ) => Promise.resolve(terminal()).then(resolve, reject),
  }
  return builder as Builder
}

// Singleton: match real Supabase browser client behavior so that consumers who
// call `createClient()` inside React components don't get a new reference each
// render (which would break useEffect/useCallback dep arrays).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _singleton: any = null

export function createMockClient() {
  if (_singleton) return _singleton
  _singleton = {
    from(table: string) {
      return makeBuilder(table)
    },
    auth: {
      getUser: async () => ({
        data: { user: DEMO_USER },
        error: null,
      }),
      getSession: async () => ({
        data: {
          session: {
            user: DEMO_USER,
            access_token: 'demo',
            refresh_token: 'demo',
            expires_in: 3600,
            token_type: 'bearer',
          },
        },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({
        data: { user: DEMO_USER, session: null },
        error: null,
      }),
      signUp: async () => ({
        data: { user: DEMO_USER, session: null },
        error: null,
      }),
      exchangeCodeForSession: async () => ({
        data: { user: DEMO_USER, session: null },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  }
  return _singleton
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MockClient = ReturnType<typeof createMockClient> & any
