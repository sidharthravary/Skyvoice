'use client';

import { useEffect } from 'react';

export default function ErrorLogger() {
  useEffect(() => {
    const handler = (msg: string | Event, url?: string, line?: number, col?: number, error?: Error) => {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1E1E1E;color:#EF4444;padding:10px 14px;font-size:11px;font-family:monospace;z-index:99999;word-break:break-all;border-top:1px solid #EF4444;max-height:40vh;overflow-y:auto;';
      div.textContent = `JS ERROR: ${msg} @ ${url}:${line}:${col}`;
      document.body.appendChild(div);
    };
    window.onerror = handler as OnErrorEventHandler;

    const rejectionHandler = (e: PromiseRejectionEvent) => {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1E1E1E;color:#F59E0B;padding:10px 14px;font-size:11px;font-family:monospace;z-index:99999;word-break:break-all;border-top:1px solid #F59E0B;max-height:40vh;overflow-y:auto;';
      div.textContent = `UNHANDLED REJECTION: ${e.reason}`;
      document.body.appendChild(div);
    };
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      window.onerror = null;
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  return null;
}
