import { Text } from '@react-email/components'
import * as React from 'react'
import { brand, EmailShell, H1, P, PrimaryButton } from './components'

/**
 * Branded login link. For use as a Supabase Auth custom email template:
 * render this to HTML and replace the url with Supabase's {{ .ConfirmationURL }}
 * placeholder (see src/emails/README.md).
 */
export function MagicLinkEmail({
  url = 'https://klunting.com/auth/callback?token=...',
}: {
  url?: string
}) {
  return (
    <EmailShell preview="Link masuk ke Klunting (sekali pakai, berlaku 1 jam).">
      <H1>Masuk ke Klunting</H1>
      <P>
        Klik tombol di bawah buat masuk ke akun kamu. Link ini sekali pakai dan
        kedaluwarsa dalam 1 jam.
      </P>
      <div style={{ margin: '8px 0 24px' }}>
        <PrimaryButton href={url}>Masuk ke Klunting</PrimaryButton>
      </div>
      <Text
        style={{
          color: brand.inkMuted,
          fontSize: 13,
          lineHeight: '20px',
          margin: 0,
        }}
      >
        Kalau kamu nggak minta link ini, abaikan aja email ini — akun kamu tetap
        aman.
      </Text>
    </EmailShell>
  )
}

MagicLinkEmail.PreviewProps = {
  url: 'https://klunting.com/auth/callback?token=sample',
}

export default MagicLinkEmail
