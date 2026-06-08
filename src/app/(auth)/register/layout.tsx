import type { Metadata } from 'next'

// Metadata-only layout. The register page is a client component ('use client')
// and cannot export `metadata`, so without this it falls back to the generic
// root title (a duplicate of /login's). Title/description live here; the root
// "%s · Klunting" template wraps it → "Bikin Akun · Klunting". Returns children
// unchanged — the (auth) group layout already provides the wrapper.
export const metadata: Metadata = {
  title: 'Bikin Akun',
  description: 'Bikin akun Klunting — coba 21 hari gratis, tanpa kartu kredit.',
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
