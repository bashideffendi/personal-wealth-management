import { Text } from '@react-email/components'
import * as React from 'react'
import { brand, DetailRow, EmailShell, H1, InfoBox, P, PrimaryButton } from './components'

export function UpgradeSuccessEmail({
  name = 'di sana',
  newPlan = 'Max',
  amount = 'Rp190.000',
  transactionId = 'KLG-0000-0000',
  periodEnd = '30 Mei 2027',
  dashboardUrl = 'https://klunting.com/dashboard',
}: {
  name?: string
  newPlan?: string
  amount?: string
  transactionId?: string
  periodEnd?: string
  dashboardUrl?: string
}) {
  return (
    <EmailShell preview={`Plan kamu di-upgrade ke ${newPlan}.`}>
      <H1>Upgrade berhasil</H1>
      <P>
        Mantap, {name}! Plan kamu sekarang <strong>{newPlan}</strong> —
        pembayaran udah dikonfirmasi dan semua fitur {newPlan} langsung kebuka.
      </P>
      <InfoBox>
        <DetailRow label="Plan baru" value={newPlan} />
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

UpgradeSuccessEmail.PreviewProps = {
  name: 'Bashid',
  newPlan: 'Max',
  amount: 'Rp190.000',
  transactionId: 'KLG-CDCB9-2614',
  periodEnd: '30 Mei 2027',
  dashboardUrl: 'https://klunting.com/dashboard',
}

export default UpgradeSuccessEmail
