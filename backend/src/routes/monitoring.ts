import { Router, Request, Response, NextFunction } from 'express';
import os from 'os';
import mongoose from 'mongoose';

const router = Router();

const startTime = Date.now();

// GET /api/monitoring — System health overview
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    const mongoState = mongoose.connection.readyState;
    const mongoStates: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    res.json({
      success: true,
      data: {
        status: 'healthy',
        uptime: Math.floor(uptime),
        uptimeFormatted: formatUptime(uptime),
        timestamp: new Date().toISOString(),
        server: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          cpuCores: cpus.length,
          cpuModel: cpus[0]?.model || 'unknown',
        },
        memory: {
          total: formatBytes(totalMem),
          free: formatBytes(freeMem),
          used: formatBytes(totalMem - freeMem),
          usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
          process: {
            rss: formatBytes(memUsage.rss),
            heapTotal: formatBytes(memUsage.heapTotal),
            heapUsed: formatBytes(memUsage.heapUsed),
            external: formatBytes(memUsage.external),
          },
        },
        database: {
          mongodb: mongoStates[mongoState] || 'unknown',
        },
        startedAt: new Date(startTime).toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/monitoring/metrics — Real-time performance metrics
router.get('/metrics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Implement actual metric collection with a metrics library
    res.json({
      success: true,
      data: {
        requestsPerMinute: 0,
        averageLatencyMs: 0,
        activeWebSocketConnections: 0,
        aiResponseTimeMs: 0,
        databaseQueryTimeMs: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

export default router;
