import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Satu sumber kebenaran buat AI client + model. Ganti 6 `new Anthropic()` +
 * string 'claude-haiku-4-5' yang tersebar di route AI. Ganti model / config
 * (timeout, retry, baseURL) cukup di sini.
 *
 * `anthropic()` = singleton per warm instance (apiKey dari ANTHROPIC_API_KEY).
 * Type Anthropic (Anthropic.Tool.InputSchema dst) tetap di-import langsung dari
 * SDK di masing-masing route — itu type, bukan duplikasi konfigurasi.
 */

export const AI_MODEL = 'claude-haiku-4-5' as const

let cached: Anthropic | null = null

export function anthropic(): Anthropic {
  if (!cached) cached = new Anthropic()
  return cached
}
