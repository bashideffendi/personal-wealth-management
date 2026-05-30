import { Text } from '@react-email/components'
import * as React from 'react'
import { brand, EmailShell, H1, P, PrimaryButton } from './components'

export function TrialEndingEmail({
  name = 'di sana',
  daysLeft = 3,
  pricingUrl = 'https://klunting.com/dashboard/pricing',
}: {
  name?: string
  daysLeft?: number
  pricingUrl?: string
}) {
  const dleft = daysLeft <= 0 ? 'hari ini' : `${daysLeft} hari lagi`
  return (
    <EmailShell preview={`Trial Klunting kamu berakhir ${dleft}.`}>
      <H1>Trial kamu berakhir {dleft}</H1>
      <P>
        Halo {name}, masa coba Klunting kamu berakhir {dleft}. Biar kekayaan
        bersih, anggaran, dan insight kamu nggak keputus, pilih paket sebelum
        trial habis.
      </P>
      <div style={{ margin: '8px 0 24px' }}>
        <PrimaryButton href={pricingUrl}>Pilih Paket</PrimaryButton>
      </div>
      <Text
        style={{
          color: brand.inkMuted,
          fontSize: 13,
          lineHeight: '20px',
          margin: 0,
        }}
      >
        Tenang — nggak ada auto-charge. Kamu yang pilih kapan dan paket apa.
      </Text>
    </EmailShell>
  )
}

TrialEndingEmail.PreviewProps = {
  name: 'Bashid',
  daysLeft: 3,
  pricingUrl: 'https://klunting.com/dashboard/pricing',
}

export default TrialEndingEmail
