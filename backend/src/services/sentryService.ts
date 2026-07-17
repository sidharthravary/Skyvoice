import * as Sentry from '@sentry/node';

// Error tracking is opt-in: set SENTRY_DSN in .env (free tier at sentry.io →
// create a Node.js project → copy its DSN) and every unexpected server error
// is reported with a full stack trace. Without a DSN this is a no-op.
let enabled = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || dsn.includes('your-sentry-dsn')) {
    console.log('[Sentry] No DSN configured — error tracking disabled');
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  enabled = true;
  console.log('[Sentry] ✅ Error tracking enabled');
}

export function captureError(err: unknown): void {
  if (enabled) Sentry.captureException(err);
}
