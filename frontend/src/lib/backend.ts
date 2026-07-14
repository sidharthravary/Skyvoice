// Resolve the backend URL at runtime so the app works on localhost, over the
// LAN (phone on the same Wi-Fi), and behind the dev HTTPS proxy.
//
// - Over HTTPS (scripts/https-proxy.js, port 3443): the proxy routes /api and
//   /socket.io to the backend, so the backend is simply the page's own origin.
// - Over plain HTTP: the backend is the same host on port 3011 (never a
//   hardcoded IP — the machine's LAN address changes with DHCP).
export function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  if (typeof window !== "undefined") {
    if (window.location.protocol === "https:") return window.location.origin;
    return `${window.location.protocol}//${window.location.hostname}:3011`;
  }
  return "http://localhost:3011";
}
