/**
 * Katalog pesan dipecah per-locale (dulu satu file 291KB id+en yang ter-bundle
 * ke SEMUA halaman): messages-id.ts = default sinkron, messages-en.ts = dynamic
 * import saat locale en. File ini tinggal tipe + re-export id untuk kompat.
 */

import { id } from './messages-id'

export { id as messagesId }
export type Locale = 'id' | 'en'
export type MessageKeys = keyof typeof id
