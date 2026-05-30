import * as Sentry from '@sentry/nextjs'

// Sentry — Node.js server runtime. Privacy-hardened for a financial app under
// UU PDP: no PII, no local-variable capture (would leak balances / amounts /
// tokens onto stack frames), no log forwarding. The beforeSend scrubber strips
// request body, cookies, headers and query string before anything is sent.
Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    'https://f56e722f3815392f65e4ebad0af540d5@o4511474451021824.ingest.de.sentry.io/4511474473107536',
  sendDefaultPii: false,
  includeLocalVariables: false,
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
