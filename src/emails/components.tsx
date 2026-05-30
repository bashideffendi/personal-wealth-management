/**
 * Shared building blocks for all Klunting transactional emails.
 *
 * Design: quiet-luxury / "ink" — near-black brand, clean light body, Inter.
 * NOT Budggt's neon look. Uses inline styles (email clients are picky; inline
 * styles are the most portable). Named exports only (no default export) so the
 * react-email CLI doesn't treat this file as a standalone email.
 */
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

/* Brand tokens — mirror of the app's quiet-luxury palette. */
export const brand = {
  ink: '#0A0A0F',
  inkSoft: '#3F3F46',
  inkMuted: '#71717A',
  surface: '#F4F4F5',
  card: '#FFFFFF',
  border: '#E4E4E7',
  mint: '#10B981',
  coral: '#F43F5E',
  white: '#FFFFFF',
}

export const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export const styles = {
  main: {
    backgroundColor: brand.surface,
    fontFamily: fontStack,
    margin: 0,
    padding: '32px 12px',
  } as React.CSSProperties,
  container: {
    backgroundColor: brand.card,
    borderRadius: 16,
    border: `1px solid ${brand.border}`,
    maxWidth: 520,
    margin: '0 auto',
    overflow: 'hidden',
  } as React.CSSProperties,
  header: { backgroundColor: brand.ink, padding: '20px 32px' } as React.CSSProperties,
  monogram: {
    backgroundColor: brand.white,
    color: brand.ink,
    width: 30,
    height: 30,
    borderRadius: 8,
    fontSize: 17,
    fontWeight: 800,
    textAlign: 'center',
    lineHeight: '30px',
    letterSpacing: '-0.04em',
  } as React.CSSProperties,
  wordmark: {
    color: brand.white,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: 0,
    paddingLeft: 12,
  } as React.CSSProperties,
  body: { padding: '32px' } as React.CSSProperties,
  h1: {
    color: brand.ink,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: '0 0 12px',
  } as React.CSSProperties,
  p: {
    color: brand.inkSoft,
    fontSize: 15,
    lineHeight: '24px',
    margin: '0 0 16px',
  } as React.CSSProperties,
  button: {
    backgroundColor: brand.ink,
    color: brand.white,
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 12,
    padding: '12px 24px',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
  infoBox: {
    backgroundColor: brand.surface,
    borderRadius: 12,
    padding: 20,
    margin: '8px 0 24px',
  } as React.CSSProperties,
  footer: { padding: '0 32px 32px' } as React.CSSProperties,
  footerText: {
    color: brand.inkMuted,
    fontSize: 12,
    lineHeight: '18px',
    margin: '4px 0',
  } as React.CSSProperties,
  hr: { borderColor: brand.border, margin: '0 0 20px' } as React.CSSProperties,
}

export function EmailShell({
  preview,
  children,
}: {
  preview: string
  children: React.ReactNode
}) {
  return (
    <Html lang="id">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Row>
              <Column style={{ width: 30 }}>
                <div style={styles.monogram}>K</div>
              </Column>
              <Column>
                <Text style={styles.wordmark}>Klunting</Text>
              </Column>
            </Row>
          </Section>

          <Section style={styles.body}>{children}</Section>

          <Section style={styles.footer}>
            <Hr style={styles.hr} />
            <Text style={styles.footerText}>
              Klunting — kelola keuangan pribadi dengan bijak.
            </Text>
            <Text style={styles.footerText}>
              Butuh bantuan? Balas email ini atau hubungi{' '}
              <Link
                href="mailto:halo@klunting.com"
                style={{ color: brand.inkMuted, textDecoration: 'underline' }}
              >
                halo@klunting.com
              </Link>
              .
            </Text>
            <Text style={styles.footerText}>
              Kamu menerima email ini karena ada aktivitas di akun Klunting kamu.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function H1({ children }: { children: React.ReactNode }) {
  return (
    <Heading as="h1" style={styles.h1}>
      {children}
    </Heading>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>
}

export function PrimaryButton({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Button href={href} style={styles.button}>
      {children}
    </Button>
  )
}

export function InfoBox({ children }: { children: React.ReactNode }) {
  return <Section style={styles.infoBox}>{children}</Section>
}

export function DetailRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <Row style={{ paddingBottom: 8 }}>
      <Column>
        <Text style={{ color: brand.inkMuted, fontSize: 13, margin: 0 }}>{label}</Text>
      </Column>
      <Column style={{ textAlign: 'right' }}>
        <Text
          style={{
            color: brand.ink,
            fontSize: 14,
            fontWeight: strong ? 700 : 600,
            margin: 0,
          }}
        >
          {value}
        </Text>
      </Column>
    </Row>
  )
}
