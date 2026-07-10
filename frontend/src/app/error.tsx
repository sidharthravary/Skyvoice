'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 40, color: 'white', background: '#0F172A', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h2 style={{ color: '#EF4444', marginBottom: 12 }}>Something went wrong</h2>
      <p style={{ color: '#94A3B8', marginBottom: 20, wordBreak: 'break-all' }}>{error.message}</p>
      <pre style={{ color: '#64748B', fontSize: 11, whiteSpace: 'pre-wrap', marginBottom: 20 }}>
        {error.stack}
      </pre>
      <button
        onClick={reset}
        style={{ padding: '8px 20px', background: '#4F7DF3', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  );
}
