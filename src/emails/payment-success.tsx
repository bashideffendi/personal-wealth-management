import { Text } from '@react-email/components'
import * as React from 'react'
import { brand, DetailRow, EmailShell, H1, InfoBox, P, PrimaryButton } from './components'

export function PaymentSuccessEmail({
  name = 'di sana',
  plan = 'Pro',
  amount = 'Rp149.000',
  transactionId = 'KLG-0000-0000',
  periodEnd = '30 Mei 2027',
  dashboardUrl = 'https://klunting.com/dashboard',
}: {
  name?: string
  plan?: string
  amount?: string
  transactionId?: string
  periodEnd?: string
  dashboardUrl?: string
}) {
  return (
    <EmailShell preview={`Pembayaran berhasil — paket ${plan} aktif.`}>
      <H1>Pembayaran berhasil</H1>
      <P>
        Makasih, {name}! Paket <strong>{plan}</strong> kamu udah aktif. Ini
        rinciannya:
      </P>
      <InfoBox>
        <DetailRow label="Paket" value={plan} />
        <DetailRow label="Jumlah" value={amount} strong />
        <DetailRow label="ID Transaksi" value={transactionId} />
        <DetailRow label="Aktif sampai" value={periodEnd} />
      </InfoBox>
      <PrimaryButton href={dashboardUrl}>Buka Dashboard</PrimaryButton>
      <Text
        style={{
          color: brand.inkMuted,
          fontSize: 13,
          lineHeight: '20px',
          margin: '20px 0 0',
        }}
      >
        Simpan email ini sebagai bukti pembayaran.
      </Text>
    </EmailShell>
  )
}

PaymentSuccessEmail.PreviewProps = {
  name: 'Bashid',
  plan: 'Pro',
  amount: 'Rp149.000',
  transactionId: 'KLG-CDCB9-2613',
  periodEnd: '30 Mei 2027',
  dashboardUrl: 'https://klunting.com/dashboard',
}

export default PaymentSuccessEmail
