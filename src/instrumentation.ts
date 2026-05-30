import * as Sentry from '@sentry/nextjs'

// Server-side registration hook. Next.js calls register() once per runtime;
// it loads the matching Sentry config. onRequestError forwards server errors
// (App Router / route handlers) to Sentry.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
