import { Text } from '@react-email/components'
import * as React from 'react'
import { brand, DetailRow, EmailShell, H1, InfoBox, P, PrimaryButton } from './components'

/**
 * Manual-renewal reminder. Klunting has auto-renew OFF (a deliberate trust
 * differentiator), so subscribers must renew themselves. Send at H-14, H-3, H-0
 * by varying `daysLeft`. The optional early-renew discount note reflects the
 * pricing decision (15% if renewed within 7 days).
 */
export function RenewalReminderEmail({
  name = 'di sana',
  plan = 'Pro',
  daysLeft = 14,
  expiryDate = '13 Jun 2026',
  price = 'Rp149.000',
  renewUrl = 'https://klunting.com/dashboard/pricing',
  discountNote = 'Perpanjang dalam 7 hari ke depan dapat diskon 15%.',
}: {
  name?: string
  plan?: string
  daysLeft?: number
  expiryDate?: string
  price?: string
  renewUrl?: string
  discountNote?: string
}) {
  const dleft = daysLeft <= 0 ? 'hari ini' : `${daysLeft} hari lagi`
  return (
    <EmailShell preview={`Langganan ${plan} kamu berakhir ${dleft}.`}>
      <H1>Langganan kamu berakhir {dleft}</H1>
      <P>
        Halo {name}, paket <strong>{plan}</strong> kamu berakhir pada{' '}
        {expiryDate}. Klunting nggak pakai auto-charge — jadi perpanjang manual
        biar akses dan datamu tetap jalan tanpa putus.
      </P>
      <InfoBox>
        <DetailRow label="Paket" value={plan} />
        <DetailRow label="Berakhir" value={expiryDate} />
        <DetailRow label="Biaya perpanjang" value={price} strong />
      </InfoBox>
      <PrimaryButton href={renewUrl}>Perpanjang Sekarang</PrimaryButton>
      {discountNote ? (
        <Text
          style={{
            color: brand.mint,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: '20px',
            margin: '20px 0 0',
          }}
        >
          {discountNote}
        </Text>
      ) : null}
      <Text
        style={{
          color: brand.inkMuted,
          fontSize: 13,
          lineHeight: '20px',
          margin: '8px 0 0',
        }}
      >
        Data kamu tetap aman walau langganan berakhir.
      </Text>
    </EmailShell>
  )
}

RenewalReminderEmail.PreviewProps = {
  name: 'Bashid',
  plan: 'Pro',
  daysLeft: 14,
  expiryDate: '13 Jun 2026',
  price: 'Rp149.000',
  renewUrl: 'https://klunting.com/dashboard/pricing',
  discountNote: 'Perpanjang dalam 7 hari ke depan dapat diskon 15%.',
}

export default RenewalReminderEmail
