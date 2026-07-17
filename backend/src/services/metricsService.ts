import os from 'os';
import type { Server as SocketIOServer } from 'socket.io';

// Small registry so routes can report real runtime metrics without
// importing the server module (avoids circular imports).

let io: SocketIOServer | null = null;
export function setIoInstance(server: SocketIOServer): void {
  io = server;
}

export function getWsClientCount(): number {
  return io?.engine?.clientsCount ?? 0;
}

// CPU usage measured as the busy share of all cores since the last call.
let lastCpuTimes = cpuTotals();

function cpuTotals(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total };
}

export function getCpuUsagePercent(): number {
  const now = cpuTotals();
  const idleDelta = now.idle - lastCpuTimes.idle;
  const totalDelta = now.total - lastCpuTimes.total;
  lastCpuTimes = now;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)));
}
