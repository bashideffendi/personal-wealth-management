import { Text } from '@react-email/components'
import * as React from 'react'
import { brand, DetailRow, EmailShell, H1, InfoBox, P, PrimaryButton } from './components'

/**
 * Dunning email — payment failed. Sent on a failed charge (Fase 2 webhook).
 * Reassures the account stays active through a grace period so the user can fix
 * payment without losing access.
 */
export function PaymentFailedEmail({
  name = 'di sana',
  plan = 'Pro',
  amount = 'Rp149.000',
  gracePeriodEnd = '6 Jun 2026',
  retryUrl = 'https://klunting.com/dashboard/pricing',
}: {
  name?: string
  plan?: string
  amount?: string
  gracePeriodEnd?: string
  retryUrl?: string
}) {
  return (
    <EmailShell preview="Pembayaran Klunting gagal — perbarui biar akses nggak keputus.">
      <H1>Pembayaran gagal</H1>
      <P>
        Halo {name}, pembayaran buat paket <strong>{plan}</strong> nggak berhasil
        diproses. Tenang — akun kamu masih aktif sampai {gracePeriodEnd}.
        Perbarui pembayaran sebelum itu biar akses dan datamu tetap jalan.
      </P>
      <InfoBox>
        <DetailRow label="Paket" value={plan} />
        <DetailRow label="Jumlah" value={amount} strong />
        <DetailRow label="Aktif sampai" value={gracePeriodEnd} />
      </InfoBox>
      <PrimaryButton href={retryUrl}>Perbarui Pembayaran</PrimaryButton>
      <Text
        style={{
          color: brand.inkMuted,
          fontSize: 13,
          lineHeight: '20px',
          margin: '20px 0 0',
        }}
      >
        Kalau ini keliru atau kamu butuh bantuan, balas aja email ini.
      </Text>
    </EmailShell>
  )
}

PaymentFailedEmail.PreviewProps = {
  name: 'Bashid',
  plan: 'Pro',
  amount: 'Rp149.000',
  gracePeriodEnd: '6 Jun 2026',
  retryUrl: 'https://klunting.com/dashboard/pricing',
}

export default PaymentFailedEmail
