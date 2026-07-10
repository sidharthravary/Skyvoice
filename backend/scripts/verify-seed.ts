import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import './setup-dns';
import mongoose from 'mongoose';
import { Appointment } from '../src/models/appointment.model';
import { KnowledgeBase } from '../src/models/knowledgeBase.model';
import { Conversation } from '../src/models/conversation.model';

interface CheckResult { label: string; pass: boolean; detail: string }
const results: CheckResult[] = [];

function check(label: string, pass: boolean, detail: string) {
  results.push({ label, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${label}: ${detail}`);
}

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('✅ Connected to Atlas\n');

  // ── 1. Appointments for today (15-06-2026) ──
  const todayStart = new Date(Date.UTC(2026, 5, 15, 0, 0, 0));
  const todayEnd   = new Date(Date.UTC(2026, 5, 15, 23, 59, 59));
  const todayAppts = await Appointment.find({ date: { $gte: todayStart, $lte: todayEnd } });
  const todayConfirmed = todayAppts.filter(a => a.status === 'confirmed');
  check(
    'Appointments today (15-06-2026)',
    todayConfirmed.length === 2,
    `${todayConfirmed.length} confirmed (expected 2) — ${todayConfirmed.map(a => a.visitorName || a.name).join(', ')}`
  );

  // ── 2. Appointments this week (15–21 June 2026) ──
  const weekStart = new Date(Date.UTC(2026, 5, 15, 0, 0, 0));
  const weekEnd   = new Date(Date.UTC(2026, 5, 21, 23, 59, 59));
  const weekAppts = await Appointment.find({ date: { $gte: weekStart, $lte: weekEnd } });
  check(
    'Appointments this week',
    weekAppts.length === 8,
    `${weekAppts.length} total (expected 8)`
  );

  // ── 3. KB search: "AgriVision" ──
  const agriDocs = await KnowledgeBase.find({
    $or: [
      { title: { $regex: 'AgriVision', $options: 'i' } },
      { content: { $regex: 'AgriVision', $options: 'i' } },
    ],
  });
  check(
    'KnowledgeBase search "AgriVision"',
    agriDocs.length >= 2,
    `${agriDocs.length} documents found (expected ≥2)`
  );

  // ── 4. KB search: "pending" ──
  const pendingDocs = await KnowledgeBase.find({
    $or: [
      { title: { $regex: 'pending', $options: 'i' } },
      { content: { $regex: 'pending', $options: 'i' } },
    ],
  });
  const pendingTasksDoc = pendingDocs.find(d => d.title.toLowerCase().includes('pending'));
  check(
    'KnowledgeBase search "pending tasks"',
    !!pendingTasksDoc,
    pendingTasksDoc ? `Found: "${pendingTasksDoc.title}"` : 'Pending Tasks document not found'
  );

  // ── 5. KB search: "this week" ──
  const weekDocs = await KnowledgeBase.find({
    $or: [
      { title: { $regex: 'this week', $options: 'i' } },
      { title: { $regex: 'schedule', $options: 'i' } },
      { content: { $regex: 'this week', $options: 'i' } },
    ],
  });
  const weekScheduleDoc = weekDocs.find(d => d.title.toLowerCase().includes('week') || d.title.toLowerCase().includes('schedule'));
  check(
    'KnowledgeBase search "this week"',
    !!weekScheduleDoc,
    weekScheduleDoc ? `Found: "${weekScheduleDoc.title}"` : 'Weekly schedule document not found'
  );

  // ── 6. Conversations count ──
  const convCount = await Conversation.countDocuments();
  check(
    'Total conversations',
    convCount >= 3,
    `${convCount} total (expected ≥3)`
  );

  // ── 7. Cancelled appointments ──
  const cancelled = await Appointment.find({ status: 'cancelled' });
  check(
    'Cancelled appointments',
    cancelled.length === 1,
    `${cancelled.length} cancelled — ${cancelled.map(a => (a.visitorName || a.name) + ' on ' + a.date.toISOString().slice(0, 10)).join(', ')}`
  );

  // ── 8. Investor meeting exists ──
  const investorAppt = await Appointment.findOne({ notes: { $regex: 'investor', $options: 'i' } });
  check(
    'Investor meeting found',
    !!investorAppt,
    investorAppt ? `${investorAppt.visitorName || investorAppt.name} on ${investorAppt.date.toISOString().slice(0, 10)} at ${investorAppt.time}` : 'Not found'
  );

  // ── Summary ──
  console.log('\n────────────────────────────────────────');
  console.log('SKYVOICE SEED VERIFICATION REPORT');
  console.log('────────────────────────────────────────');
  const padded = (s: string) => s.padEnd(40);
  for (const r of results) {
    console.log(`${padded(r.label)}${r.pass ? '✅ PASS' : '❌ FAIL'}`);
  }
  console.log('────────────────────────────────────────');

  const allPass = results.every(r => r.pass);
  if (allPass) {
    console.log('All seed data verified — Atlas is ready for live demos 🚀');
  } else {
    console.log(`⚠️  ${results.filter(r => !r.pass).length} check(s) failed`);
    process.exit(1);
  }

  await mongoose.disconnect();
}

verify().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
