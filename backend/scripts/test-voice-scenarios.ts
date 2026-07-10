import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import './setup-dns';
import mongoose from 'mongoose';
import { Appointment } from '../src/models/appointment.model';
import { searchKnowledge } from '../src/services/ragService';

// ── Date utilities (mirrors voicePipeline.ts) ─────────────────────────────────

function extractDateRange(q: string): { start: Date; end: Date; label: string } | null {
  const now = new Date();
  const y = now.getUTCFullYear(), mo = now.getUTCMonth(), d = now.getUTCDate();

  const hasTodayHint    = q.includes('today') || q.includes('now') || q.includes('currently');
  const hasTomorrowHint = q.includes('tomorrow');
  const hasWeekHint     = q.includes('this week') || q.includes('week');
  const hasMeetingHint  = q.includes('meeting') || q.includes('appointment') || q.includes('schedule') || q.includes('call');

  if (hasTomorrowHint) {
    return {
      start: new Date(Date.UTC(y, mo, d + 1, 0, 0, 0)),
      end:   new Date(Date.UTC(y, mo, d + 1, 23, 59, 59)),
      label: 'tomorrow',
    };
  }
  if (hasWeekHint) {
    const dow = now.getDay();
    const toMon = dow === 0 ? -6 : 1 - dow;
    return {
      start: new Date(Date.UTC(y, mo, d + toMon, 0, 0, 0)),
      end:   new Date(Date.UTC(y, mo, d + toMon + 6, 23, 59, 59)),
      label: 'this week',
    };
  }

  const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (q.includes(DAY_NAMES[i])) {
      const dow = now.getDay();
      let diff = i - dow;
      if (diff < 0) diff += 7;
      const target = new Date(Date.UTC(y, mo, d + diff, 0, 0, 0));
      return {
        start: target,
        end:   new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 23, 59, 59)),
        label: `on ${DAY_NAMES[i].charAt(0).toUpperCase() + DAY_NAMES[i].slice(1)}`,
      };
    }
  }

  if (hasTodayHint || hasMeetingHint) {
    return {
      start: new Date(Date.UTC(y, mo, d, 0, 0, 0)),
      end:   new Date(Date.UTC(y, mo, d, 23, 59, 59)),
      label: 'today',
    };
  }
  return null;
}

function classifyIntentKeywords(text: string): string {
  const q = text.toLowerCase();
  const DAY_NAMES = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const hasDayOrTimeRef = DAY_NAMES.some(dy => q.includes(dy)) ||
    q.includes('today') || q.includes('tomorrow') || q.includes('this week') || q.includes('week');

  if (
    q.includes('uptime') || q.includes('latency') || q.includes('stats') || q.includes('status') ||
    q.includes('metrics') || q.includes('pending') || q.includes('tasks') || q.includes('blockers') ||
    q.includes('cancelled') || q.includes('investor') || q.includes('priorities') ||
    ((q.includes('meeting') || q.includes('appointment') || q.includes('call')) && hasDayOrTimeRef)
  ) return 'operational_query';

  if (q.includes('book') || q.includes('schedule') || q.includes('appointment') || q.includes('meeting')) return 'booking_request';
  return 'unknown';
}

function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// ── Context builder (mirrors voicePipeline.ts buildOperationalContext) ────────

async function buildContext(text: string): Promise<string> {
  const q = text.toLowerCase();
  const parts: string[] = [];

  const wantsSchedule =
    q.includes('meeting') || q.includes('appointment') || q.includes('schedule') ||
    q.includes('today') || q.includes('tomorrow') || q.includes('week') ||
    q.includes('who') || q.includes('call') || q.includes('cancelled') || q.includes('investor');

  if (wantsSchedule) {
    const range = extractDateRange(q);
    const filter: Record<string, unknown> = {};
    if (range) filter.date = { $gte: range.start, $lte: range.end };

    const appts = await Appointment.find(filter).sort({ date: 1, time: 1 }).limit(20);

    if (appts.length > 0) {
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const mos  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const lines = appts.map(a => {
        const who = a.visitorName || a.name;
        const ds = `${days[a.date.getUTCDay()]} ${mos[a.date.getUTCMonth()]} ${a.date.getUTCDate()}`;
        const st = a.status !== 'confirmed' ? ` [${a.status}]` : '';
        return `  • ${ds} at ${a.time} — ${who}${st}: ${a.notes || ''}`;
      });
      parts.push(`Appointments ${range?.label ?? ''}:\n${lines.join('\n')}`);

      if (range) {
        console.log(`    └─ Date range: ${fmtDate(range.start)} → ${fmtDate(range.end)} (${range.label})`);
      }
      console.log(`    └─ Atlas returned ${appts.length} appointment(s)`);
    } else {
      parts.push(`No appointments found ${range?.label ?? ''}.`);
      if (range) console.log(`    └─ Date range: ${fmtDate(range.start)} → ${fmtDate(range.end)} — 0 results`);
    }
  }

  const hits = await searchKnowledge(text, 3);
  if (hits.length > 0) {
    const kbText = hits.slice(0, 2).map(h => `${h.title}:\n${h.content}`).join('\n\n');
    parts.push(`Relevant knowledge:\n${kbText}`);
    console.log(`    └─ KB search: ${hits.length} hit(s) — "${hits[0].title}"`);
  }

  return parts.join('\n\n---\n\n');
}

// ── Test scenarios ─────────────────────────────────────────────────────────────

interface Scenario {
  phrase: string;
  expectedIntent: string;
  mustContain: string[];    // ALL must appear in context (case-insensitive)
  description: string;
}

const SCENARIOS: Scenario[] = [
  {
    phrase: 'Hey, do we have any meetings today?',
    expectedIntent: 'operational_query',
    mustContain: ['arjun', 'priya'],
    description: 'Today\'s meetings → Arjun Menon 09:30 + Priya Nair 14:00',
  },
  {
    phrase: "What's the current status of the AerionAI project?",
    expectedIntent: 'operational_query',
    mustContain: ['sprint', '78'],
    description: 'AerionAI status → Sprint 3, 78%, Rahul Sharma tomorrow',
  },
  {
    phrase: 'Are there any pending tasks this week?',
    expectedIntent: 'operational_query',
    mustContain: ['pending', 'karnataka'],
    description: 'Pending tasks → Karnataka docs, obstacle avoidance, radar bug',
  },
  {
    phrase: 'Who are we meeting on Thursday?',
    expectedIntent: 'operational_query',
    mustContain: ['meera', '13:00'],
    description: 'Thursday meeting → Meera Thomas 13:00 Series A investor call',
  },
  {
    phrase: 'Any cancelled meetings this week?',
    expectedIntent: 'operational_query',
    mustContain: ['ananya', 'cancelled'],
    description: 'Cancelled → Ananya Suresh Friday field visit',
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('✅ Connected to Atlas\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log(' SKYVOICE VOICE PIPELINE — SCENARIO TESTS');
  console.log('═══════════════════════════════════════════════════════\n');

  const results: Array<{ scenario: string; pass: boolean; failures: string[] }> = [];

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    console.log(`── Scenario ${i + 1}: "${s.phrase}"`);
    console.log(`   Expected: ${s.description}`);

    const failures: string[] = [];

    // 1. Intent classification
    const intent = classifyIntentKeywords(s.phrase);
    const intentOk = intent === s.expectedIntent;
    console.log(`   Intent  : ${intent} ${intentOk ? '✅' : `❌ (expected ${s.expectedIntent})`}`);
    if (!intentOk) failures.push(`Intent: got "${intent}", expected "${s.expectedIntent}"`);

    // 2. Build context (Atlas queries)
    let context = '';
    try {
      context = await buildContext(s.phrase);
    } catch (err) {
      failures.push(`Context build error: ${(err as Error).message}`);
      console.error(`   ❌ Context build failed:`, (err as Error).message);
    }

    // 3. Check required entities
    const ctxLower = context.toLowerCase();
    for (const token of s.mustContain) {
      const found = ctxLower.includes(token.toLowerCase());
      console.log(`   Check   : "${token}" in context → ${found ? '✅' : '❌ NOT FOUND'}`);
      if (!found) failures.push(`Expected "${token}" in context`);
    }

    const pass = failures.length === 0;
    results.push({ scenario: `${i + 1}. ${s.phrase}`, pass, failures });
    console.log(`   Result  : ${pass ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  // ── Summary ──
  console.log('═══════════════════════════════════════════════════════');
  console.log(' RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} ${r.scenario}`);
    if (!r.pass) r.failures.forEach(f => console.log(`     ↳ ${f}`));
  }
  const passed = results.filter(r => r.pass).length;
  console.log(`\n${passed}/${results.length} scenarios passed`);

  if (passed < results.length) {
    console.log('\n⚠️  Some scenarios failed — check the failures above for the broken pipeline step.');
    process.exit(1);
  } else {
    console.log('\n🚀 All voice scenarios verified — Atlas data pipeline is ready for live demo.');
  }

  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('❌ Test run failed:', err);
  process.exit(1);
});
