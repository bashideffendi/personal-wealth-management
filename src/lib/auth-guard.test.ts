import { describe, it, expect, afterEach } from 'vitest'
import { verifyCronAuth, trustedOrigin, isKnownPushEndpoint } from './auth-guard'

const ORIG_SITE = process.env.NEXT_PUBLIC_SITE_URL
afterEach(() => {
  if (ORIG_SITE === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = ORIG_SITE
})

describe('verifyCronAuth', () => {
  it('fail-closed kalau secret kosong/absen', () => {
    expect(verifyCronAuth('Bearer x', '')).toBe(false)
    expect(verifyCronAuth('Bearer undefined', undefined)).toBe(false)
    expect(verifyCronAuth(null, 's3cret')).toBe(false)
  })
  it('hanya menerima Bearer yang persis sama', () => {
    expect(verifyCronAuth('Bearer s3cret', 's3cret')).toBe(true)
    expect(verifyCronAuth('Bearer s3cre', 's3cret')).toBe(false)
    expect(verifyCronAuth('Bearer s3cretX', 's3cret')).toBe(false)
    expect(verifyCronAuth('s3cret', 's3cret')).toBe(false)
    expect(verifyCronAuth('bearer s3cret', 's3cret')).toBe(false)
  })
})

describe('trustedOrigin', () => {
  it('pakai NEXT_PUBLIC_SITE_URL (origin saja), abaikan URL request', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://klunting.com/some/path'
    expect(trustedOrigin('https://evil.example/api/x')).toBe('https://klunting.com')
  })
  it('fallback ke origin URL request lalu default', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(trustedOrigin('http://localhost:3000/api/household/invite')).toBe('http://localhost:3000')
    expect(trustedOrigin()).toBe('https://klunting.com')
  })
})

describe('isKnownPushEndpoint', () => {
  it('menerima push service browser utama', () => {
    expect(isKnownPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(isKnownPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true)
    expect(isKnownPushEndpoint('https://web.push.apple.com/QAbc')).toBe(true)
    expect(isKnownPushEndpoint('https://wns2-db5p.notify.windows.com/w/?token=abc')).toBe(true)
  })
  it('menolak host lain, http, port, userinfo, dan suffix palsu', () => {
    expect(isKnownPushEndpoint('https://169.254.169.254/latest/meta-data')).toBe(false)
    expect(isKnownPushEndpoint('https://internal.example.com/hook')).toBe(false)
    expect(isKnownPushEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false)
    expect(isKnownPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false)
    expect(isKnownPushEndpoint('https://user:pw@fcm.googleapis.com/x')).toBe(false)
    expect(isKnownPushEndpoint('https://evilfcm.googleapis.com.attacker.io/x')).toBe(false)
    expect(isKnownPushEndpoint('https://notfcm.googleapis.com.evil/x')).toBe(false)
    expect(isKnownPushEndpoint('not a url')).toBe(false)
  })
})
