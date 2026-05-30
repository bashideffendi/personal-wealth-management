import { Column, Row, Section, Text } from '@react-email/components'
import * as React from 'react'
import { brand, EmailShell, H1, P, PrimaryButton } from './components'

const stepNum: React.CSSProperties = {
  backgroundColor: brand.ink,
  color: brand.white,
  width: 26,
  height: 26,
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  textAlign: 'center',
  lineHeight: '26px',
}
const stepTitle: React.CSSProperties = {
  color: brand.ink,
  fontSize: 15,
  fontWeight: 600,
  margin: '0 0 2px',
}
const stepDesc: React.CSSProperties = {
  color: brand.inkMuted,
  fontSize: 14,
  lineHeight: '20px',
  margin: 0,
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <Section style={{ paddingBottom: 14 }}>
      <Row>
        <Column style={{ width: 26, verticalAlign: 'top' }}>
          <div style={stepNum}>{n}</div>
        </Column>
        <Column style={{ paddingLeft: 14, verticalAlign: 'top' }}>
          <Text style={stepTitle}>{title}</Text>
          <Text style={stepDesc}>{desc}</Text>
        </Column>
      </Row>
    </Section>
  )
}

export function WelcomeEmail({
  name = 'di sana',
  dashboardUrl = 'https://klunting.com/dashboard',
}: {
  name?: string
  dashboardUrl?: string
}) {
  return (
    <EmailShell preview="Selamat datang di Klunting — yuk mulai kelola keuanganmu.">
      <H1>Selamat datang di Klunting</H1>
      <P>
        Halo {name}, akun kamu udah aktif. Klunting bantu kamu lihat seluruh
        kondisi keuangan — transaksi, anggaran, investasi, sampai kekayaan bersih
        — di satu tempat. Tiga langkah biar mulai:
      </P>

      <Section style={{ margin: '8px 0 24px' }}>
        <Step
          n={1}
          title="Catat transaksi pertama"
          desc="Tulis pemasukan atau pengeluaran — atau foto struk, biar AI yang isi otomatis."
        />
        <Step
          n={2}
          title="Atur anggaran"
          desc="Tentuin budget bulanan per kategori biar pengeluaran tetap kekontrol."
        />
        <Step
          n={3}
          title="Lihat kekayaan bersih"
          desc="Tambahin akun, investasi, dan aset — pantau net worth kamu berkembang."
        />
      </Section>

      <PrimaryButton href={dashboardUrl}>Buka Dashboard</PrimaryButton>
    </EmailShell>
  )
}

WelcomeEmail.PreviewProps = {
  name: 'Bashid',
  dashboardUrl: 'https://klunting.com/dashboard',
}

export default WelcomeEmail
