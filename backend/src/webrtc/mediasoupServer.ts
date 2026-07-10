import * as mediasoup from 'mediasoup';

let worker: mediasoup.types.Worker | null = null;

const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
  { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2, preferredPayloadType: 100 },
];

export async function initMediasoup(): Promise<void> {
  try {
    worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });

    worker.on('died', () => {
      console.error('❌ mediasoup Worker died — WebRTC audio bridging disabled');
      worker = null;
    });

    console.log('✅ mediasoup Worker initialized');
  } catch (err) {
    console.error('❌ mediasoup Worker failed to initialize:', err);
    worker = null;
  }
}

export function isWorkerReady(): boolean {
  return worker !== null;
}

export async function createRouter(): Promise<mediasoup.types.Router | null> {
  if (!worker) return null;
  try {
    return await worker.createRouter({ mediaCodecs });
  } catch (err) {
    console.error('[mediasoup] createRouter error:', err);
    return null;
  }
}

export async function createWebRtcTransport(
  router: mediasoup.types.Router
): Promise<mediasoup.types.WebRtcTransport> {
  return router.createWebRtcTransport({
    listenIps: [{ ip: '127.0.0.1' }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });
}

export async function createPlainTransport(
  router: mediasoup.types.Router
): Promise<mediasoup.types.PlainTransport> {
  return router.createPlainTransport({
    listenIp: { ip: '127.0.0.1' },
    rtcpMux: true,
    comedia: false,
  });
}
