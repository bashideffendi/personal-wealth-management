/**
 * Web Push — helper sisi CLIENT (browser).
 *
 * Alur subscribe: register /sw.js → minta izin Notification →
 * pushManager.subscribe (VAPID public key dari env) → POST /api/push/subscribe
 * biar server nyimpen endpoint+keys di tabel push_subscriptions.
 *
 * Catatan: service-worker-register.tsx cuma register SW di production;
 * di sini register lagi eksplisit (idempoten — browser reuse registrasi
 * yang sama) supaya toggle notifikasi tetap bisa dites di dev.
 */

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** applicationServerKey wajib Uint8Array — konversi dari base64url VAPID public key. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export type PushRegisterResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'no_key' | 'denied' | 'subscribe_failed' | 'save_failed'; message?: string }

/** Cek apakah device ini sudah punya subscription aktif (buat state toggle). */
export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  if (Notification.permission !== 'granted') return null
  const registration = await navigator.serviceWorker.getRegistration('/')
  if (!registration) return null
  return registration.pushManager.getSubscription()
}

export async function registerPushSubscription(): Promise<PushRegisterResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return { ok: false, reason: 'no_key' }

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  let subscription: PushSubscription
  try {
    subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }))
  } catch {
    return { ok: false, reason: 'subscribe_failed' }
  }

  const json = subscription.toJSON()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    }),
  }).catch(() => null)

  if (!res || !res.ok) {
    // Server gagal nyimpen — batalkan subscription browser biar state konsisten.
    await subscription.unsubscribe().catch(() => {})
    const message = res ? ((await res.json().catch(() => null))?.error as string | undefined) : undefined
    return { ok: false, reason: 'save_failed', message }
  }
  return { ok: true }
}

export async function unregisterPushSubscription(): Promise<void> {
  const subscription = await getActivePushSubscription().catch(() => null)
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe().catch(() => {})
  // Best-effort — baris yatim di server bakal kebersihin sendiri pas kirim (404/410).
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {})
}
