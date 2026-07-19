import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
// Use __dirname-based absolute path so this works regardless of which
// directory `npm run dev` is invoked from (not CWD-relative).
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { adminOnly } from './middleware/auth';
import { setIoInstance } from './services/metricsService';
import { initSentry } from './services/sentryService';

initSentry();

// Route imports
import conversationRoutes, { myConversationsRouter } from './routes/conversations';
import appointmentRoutes from './routes/appointments';
import inquiryRoutes from './routes/inquiries';
import knowledgeRoutes from './routes/knowledge';
import analyticsRoutes from './routes/analytics';
import calendarRoutes from './routes/calendar';
import configRoutes from './routes/config';
import monitoringRoutes from './routes/monitoring';
import authRoutes from './routes/auth';
import ttsRoutes from './routes/tts';
import emailRoutes from './routes/email';
import { startReminderScheduler } from './services/reminderService';
import userRoutes from './routes/users';
import { setupVoicePipeline } from './services/voicePipeline';
import { initMediasoup } from './webrtc/mediasoupServer';

// ── Startup env diagnostics ──
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3010';
const PORT        = process.env.PORT          || 3011;

// Support comma-separated list of allowed origins (e.g. localhost + LAN IP for phone access).
// In development, reflect any origin so the app works from any LAN IP without editing .env.
const corsOrigins: boolean | string | string[] =
  process.env.NODE_ENV !== 'production'
    ? true
    : FRONTEND_URL.includes(',')
      ? FRONTEND_URL.split(',').map(o => o.trim())
      : FRONTEND_URL;

console.log(`[Env] FRONTEND_URL : ${FRONTEND_URL}`);
console.log(`[Env] PORT         : ${PORT}`);
console.log(`[Env] MONGODB_URI  : ${(process.env.MONGODB_URI || '').replace(/:([^:@]+)@/, ':***@') || '(not set)'}`);
console.log(`[Env] CORS origins : ${JSON.stringify(corsOrigins)}`);

const app    = express();
const server = http.createServer(app);

// ── Socket.io ──
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ── Middleware ──
app.use(helmet());
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// ── Health Check ──
app.get('/api/health', (_req, res) => {
  res.json({
    status:    'healthy',
    service:   'SkyVoice API',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
  });
});

// ── API Routes ──
// Admin-only surfaces are gated server-side (adminOnly = valid JWT + admin
// role); public surfaces: auth, per-user appointments, config GET (greeting).
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/conversations/mine', myConversationsRouter); // own history (any signed-in user)
app.use('/api/conversations', adminOnly, conversationRoutes);
app.use('/api/appointments',  appointmentRoutes);
app.use('/api/inquiries',     adminOnly, inquiryRoutes);
app.use('/api/knowledge',     adminOnly, knowledgeRoutes);
app.use('/api/analytics',     adminOnly, analyticsRoutes);
app.use('/api/calendar',      adminOnly, calendarRoutes);
app.use('/api/config',        configRoutes); // GET public (voice greeting); writes gated in-route
app.use('/api/tts',           ttsRoutes);   // natural voice (auth in-route)
app.use('/api/email',         emailRoutes); // status + test send (admin, in-route)
app.use('/api/monitoring',    adminOnly, monitoringRoutes);

// ── Socket.io general namespace ──
io.on('connection', (socket) => {
  console.log(`[Socket.io] General namespace: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.io] General disconnect: ${socket.id}`);
  });
});

// ── Socket.io /monitoring namespace (receives webrtc_stats from voice pipeline) ──
io.of('/monitoring').on('connection', (socket) => {
  console.log(`[Socket.io] Monitoring client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Monitoring client disconnected: ${socket.id}`);
  });
});

setupVoicePipeline(io);
setIoInstance(io); // real WS client counts for /api/monitoring
startReminderScheduler(); // day-before booking reminders (dormant until email is enabled)

// ── Error Handler (must be last) ──
app.use(errorHandler);

// ── Start Server ──
async function start() {
  // Mediasoup (WebRTC) is optional — the voice flow runs over Socket.io + browser
  // speech. Never let a mediasoup failure keep the server from starting.
  try {
    await initMediasoup();
  } catch (err) {
    console.warn('⚠️ Mediasoup init failed — WebRTC disabled, Socket.io voice path unaffected:', (err as Error)?.message ?? err);
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    const nets = os.networkInterfaces();
    const lanIps = Object.values(nets)
      .flat()
      .filter((n): n is os.NetworkInterfaceInfo => !!n && n.family === 'IPv4' && !n.internal)
      .map((n) => n.address);
    console.log(`\n🚀 SkyVoice API running on http://localhost:${PORT}`);
    console.log(`✅ Backend listening on 0.0.0.0:${PORT}${lanIps.length ? ` — reachable on LAN at ${lanIps.map((ip) => `http://${ip}:${PORT}`).join(', ')}` : ''}`);
    console.log(`🔌 Socket.io ready — CORS origins: ${JSON.stringify(corsOrigins)}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health\n`);
  });

  // Database and Redis connect in parallel — errors are logged but don't kill the server
  connectDatabase().catch((err) => {
    console.error('❌ MongoDB connection failed (voice pipeline will handle DB errors per-request):', err.message ?? err);
  });

  connectRedis().catch((err) => {
    console.error('❌ Redis connection failed (caching disabled):', err.message ?? err);
  });
}

start();

export { app, server, io };
