#!/usr/bin/env node
/**
 * Generate src/types/database.types.ts dari skema Supabase LEWAT spek OpenAPI
 * PostgREST — TANPA butuh `supabase login`, personal access token, atau
 * connection-string DB. Cukup NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * yang sudah ada di .env.local (service-role melihat seluruh skema).
 *
 * Jalankan tiap ada migrasi yang mengubah kolom/tabel/fungsi:
 *   node scripts/gen-supabase-types.mjs
 *
 * KEPUTUSAN BENTUK (lihat komentar header file hasil):
 *  - Row     = tipe akurat + nullability → reads (select/eq/order) KETAT,
 *              nangkep typo nama kolom saat compile.
 *  - Insert/Update = index-signature permisif → app membangun payload dinamis
 *              (conditional keys); typed-writes penuh akan false-error di
 *              puluhan call-site. Trade-off sadar: ketat di BACA, longgar di TULIS.
 *  - Functions = Args longgar (Record<string, unknown>) — cukup buat lolos
 *              pemanggilan .rpc('nama', args) tanpa menebak signature tiap fungsi.
 *
 * Kalau nanti mau typed-writes penuh: pakai `supabase gen types` resmi
 * (butuh login) lalu rapikan call-site insert/update satu per satu.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readEnv(key) {
  for (const f of ['.env.local', '.env']) {
    try {
      const m = readFileSync(join(root, f), 'utf8').match(new RegExp('^' + key + '=(.*)$', 'm'))
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    } catch { /* file tak ada — lanjut */ }
  }
  return null
}

const url = readEnv('NEXT_PUBLIC_SUPABASE_URL')
const key = readEnv('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) {
  console.error('Butuh NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di .env.local')
  process.exit(1)
}

function tsBase(fmt, type) {
  if (!fmt) fmt = type || ''
  if (fmt.endsWith('[]')) return tsBase(fmt.slice(0, -2)) + '[]'
  switch (fmt) {
    case 'uuid': case 'text': case 'character varying': case 'character': case 'date': case 'name':
    case 'timestamp with time zone': case 'timestamp without time zone':
    case 'time with time zone': case 'time without time zone':
    case 'interval': case 'bytea': case 'inet': case 'cidr': case 'macaddr': return 'string'
    case 'bigint': case 'integer': case 'smallint': case 'numeric':
    case 'double precision': case 'real': case 'money': case 'bigserial': case 'serial': return 'number'
    case 'boolean': return 'boolean'
    case 'json': case 'jsonb': return 'Json'
    case 'ARRAY': return 'Json[]'
    case 'USER-DEFINED': return 'string'
    default:
      if (type === 'integer' || type === 'number') return 'number'
      if (type === 'boolean') return 'boolean'
      return 'string'
  }
}
const propTs = (p) => (p.type === 'array' && p.items ? tsBase(p.items.format, p.items.type) + '[]' : tsBase(p.format, p.type))

const res = await fetch(url + '/rest/v1/', { headers: { apikey: key, Authorization: 'Bearer ' + key } })
const spec = await res.json()
const defs = spec.definitions || {}
const names = Object.keys(defs).sort()
const rpc = Object.keys(spec.paths || {}).filter((p) => p.startsWith('/rpc/')).map((p) => p.slice(5)).sort()

let out = `// AUTO-GENERATED dari skema Supabase via PostgREST OpenAPI (${names.length} tabel, ${rpc.length} fungsi).\n`
out += '// Regenerate: node scripts/gen-supabase-types.mjs (baca {SUPABASE_URL}/rest/v1/ dgn service-role key).\n'
out += '// KEPUTUSAN SADAR: Row = tipe akurat + nullability (reads ketat — nangkep typo kolom di select/eq/order).\n'
out += '// Insert/Update = index-signature permisif: app membangun payload dinamis (conditional keys); typed writes\n'
out += '// akan false-error. Functions = Args longgar. Trade-off: keamanan tipe penuh di BACA, longgar di TULIS.\n\n'
out += 'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]\n\n'
out += 'export type Database = {\n  public: {\n    Tables: {\n'
for (const n of names) {
  const d = defs[n]
  const props = d.properties || {}
  const req = new Set(d.required || [])
  const row = Object.entries(props).map(([k, v]) => '          ' + JSON.stringify(k) + ': ' + propTs(v) + (req.has(k) ? '' : ' | null'))
  out += '      ' + JSON.stringify(n) + ': {\n'
  out += '        Row: {\n' + row.join('\n') + '\n        }\n'
  out += '        Insert: { [key: string]: unknown }\n'
  out += '        Update: { [key: string]: unknown }\n'
  out += '        Relationships: []\n'
  out += '      }\n'
}
out += '    }\n    Views: { [_ in never]: never }\n    Functions: {\n'
for (const f of rpc) out += '      ' + JSON.stringify(f) + ': { Args: Record<string, unknown>; Returns: unknown }\n'
out += '    }\n    Enums: { [_ in never]: never }\n    CompositeTypes: { [_ in never]: never }\n  }\n}\n'

writeFileSync(join(root, 'src/types/database.types.ts'), out)
console.log(`OK — ${names.length} tabel, ${rpc.length} fungsi → src/types/database.types.ts`)
