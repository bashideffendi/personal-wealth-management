import type { Metadata } from 'next'

// Metadata-only layout. The login page itself is a client component
// ('use client'), which cannot export `metadata`, so without this it falls
// back to the generic root title. Title/description live here instead; the
// root layout's "%s · Klunting" template wraps the title → "Masuk · Klunting".
// Returns children unchanged — the (auth) group layout already provides the
// min-h-screen wrapper, so this adds no DOM node.
export const metadata: Metadata = {
  title: 'Masuk',
  description: 'Masuk ke akun Klunting kamu.',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
