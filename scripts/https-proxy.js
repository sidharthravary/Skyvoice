// SkyVoice dev HTTPS proxy — one secure LAN origin for the whole app.
//
//   https://<pc-ip>:3443            → frontend (Next.js on :3010)
//   https://<pc-ip>:3443/api/*      → backend  (Express on :3011)
//   https://<pc-ip>:3443/socket.io  → backend  (voice WebSocket)
//
// Why: phones on the LAN hit one https:// address, which gives a secure
// context (microphone works, Chrome's HTTPS upgrade is a no-op) and makes
// every request same-origin (no CORS, no dev-origin blocks, no stale-IP
// backend URLs). Uses only Node built-ins — no npm install needed.

const https = require('https');
const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.HTTPS_PROXY_PORT || 3443);
const FRONTEND_PORT = 3010;
const BACKEND_PORT = 3011;

const tlsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'skyvoice-dev.key')),
  cert: fs.readFileSync(path.join(__dirname, 'skyvoice-dev.crt')),
};

function targetPortFor(url) {
  return url.startsWith('/api') || url.startsWith('/socket.io')
    ? BACKEND_PORT
    : FRONTEND_PORT;
}

const server = https.createServer(tlsOptions, (req, res) => {
  const proxyReq = http.request(
    {
      host: '127.0.0.1',
      port: targetPortFor(req.url),
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`SkyVoice proxy error: ${err.message}`);
  });
  req.pipe(proxyReq);
});

// WebSocket passthrough (socket.io voice channel + Next.js HMR)
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(targetPortFor(req.url), '127.0.0.1', () => {
    let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    }
    raw += '\r\n';
    upstream.write(raw);
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(PORT, '0.0.0.0', () => {
  const lanIps = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  console.log(`\n🔒 SkyVoice HTTPS proxy on port ${PORT}`);
  console.log(`   Desktop: https://localhost:${PORT}`);
  for (const ip of lanIps) console.log(`   Phone:   https://${ip}:${PORT}`);
  console.log('   (self-signed cert — tap "Advanced → Proceed" once on the phone)\n');
});
