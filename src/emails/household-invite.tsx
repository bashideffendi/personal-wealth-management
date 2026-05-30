import { Text } from '@react-email/components'
import * as React from 'react'
import { brand, EmailShell, H1, P, PrimaryButton } from './components'

/**
 * Household sharing invite. Sent when a user invites someone to their household
 * (the join flow lives at /dashboard/join/[token]). inviteUrl carries the token.
 */
export function HouseholdInviteEmail({
  inviterName = 'Seseorang',
  householdName = 'keluarga',
  inviteUrl = 'https://klunting.com/dashboard/join/sample-token',
}: {
  inviterName?: string
  householdName?: string
  inviteUrl?: string
}) {
  return (
    <EmailShell preview={`${inviterName} ngajak kamu kelola keuangan bareng di Klunting.`}>
      <H1>Kamu diajak gabung</H1>
      <P>
        <strong>{inviterName}</strong> ngajak kamu kelola keuangan bareng di{' '}
        <strong>{householdName}</strong> lewat Klunting. Terima undangan buat mulai
        lihat dan atur keuangan bersama.
      </P>
      <div style={{ margin: '8px 0 24px' }}>
        <PrimaryButton href={inviteUrl}>Terima Undangan</PrimaryButton>
      </div>
      <Text
        style={{
          color: brand.inkMuted,
          fontSize: 13,
          lineHeight: '20px',
          margin: 0,
        }}
      >
        Kalau kamu nggak kenal {inviterName} atau ngerasa ini keliru, abaikan aja
        email ini.
      </Text>
    </EmailShell>
  )
}

HouseholdInviteEmail.PreviewProps = {
  inviterName: 'Bashid',
  householdName: 'Keluarga Effendi',
  inviteUrl: 'https://klunting.com/dashboard/join/sample-token',
}

export default HouseholdInviteEmail
