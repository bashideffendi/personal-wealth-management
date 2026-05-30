import * as Sentry from '@sentry/nextjs'

// Sentry — browser / client runtime. Privacy-hardened for a financial app:
// Session Replay is intentionally NOT enabled (it would record balances,
// amounts and account numbers on screen). No PII, no log forwarding; the
// beforeSend scrubber strips request body / cookies / headers before send.
Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    'https://f56e722f3815392f65e4ebad0af540d5@o4511474451021824.ingest.de.sentry.io/4511474473107536',
  sendDefaultPii: false,
  enableLogs: false,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies
      delete event.request.data
      delete event.request.headers
      delete event.request.query_string
    }
    if (event.user) event.user = event.user.id ? { id: event.user.id } : {}
    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
