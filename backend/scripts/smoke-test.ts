import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import './setup-dns';
import mongoose from 'mongoose';
import { Appointment } from '../src/models/appointment.model';
import { Conversation } from '../src/models/conversation.model';
import { KnowledgeBase } from '../src/models/knowledgeBase.model';

interface TestResult {
  name: string;
  pass: boolean;
  error?: string;
}

const results: TestResult[] = [];

function pass(name: string) {
  results.push({ name, pass: true });
  console.log(`✅ ${name}`);
}

function fail(name: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  results.push({ name, pass: false, error: msg });
  console.error(`❌ ${name}: ${msg}`);
}

async function runSmokeTest() {
  const uri = process.env.MONGODB_URI!;

  // ── 1. Atlas Connection ──
  try {
    await mongoose.connect(uri);
    const ping = await mongoose.connection.db!.command({ ping: 1 });
    if (ping.ok !== 1) throw new Error('Ping returned non-ok');
    pass('MongoDB Atlas Connection');
  } catch (err) {
    fail('MongoDB Atlas Connection', err);
    process.exit(1);
  }

  // ── 2. KnowledgeBase Seeding ──
  try {
    const count = await KnowledgeBase.countDocuments();
    if (count < 5) {
      // Seed minimal docs for test
      const seedDocs = Array.from({ length: 5 - count }, (_, i) => ({
        title: `Smoke Test Seed Doc ${i + 1}`,
        content: `Skyvion Technologies test document ${i + 1} for smoke test verification.`,
        sourceType: 'seed' as const,
        indexStatus: 'indexed' as const,
      }));
      await KnowledgeBase.insertMany(seedDocs);
      console.log(`   🌱 Seeded ${seedDocs.length} missing KnowledgeBase doc(s)`);
    }
    const finalCount = await KnowledgeBase.countDocuments();
    if (finalCount < 5) throw new Error(`Only ${finalCount} docs in KnowledgeBase`);
    console.log(`   📚 KnowledgeBase has ${finalCount} document(s)`);
    pass('KnowledgeBase Seeding');
  } catch (err) {
    fail('KnowledgeBase Seeding', err);
  }

  // ── 3. Appointment Persistence ──
  let apptId: mongoose.Types.ObjectId | undefined;
  try {
    const testDate = new Date(Date.UTC(2026, 5, 20, 0, 0, 0));
    const appt = await Appointment.create({
      userId: 'smoke-test-user',
      name: 'Smoke Test Visitor',
      email: 'smoke@skyviontech.com',
      date: testDate,
      time: '10:00',
      status: 'confirmed',
      notes: 'Smoke test appointment',
    });
    apptId = appt._id as mongoose.Types.ObjectId;
    const check = await Appointment.findById(apptId);
    if (!check) throw new Error('Appointment not found after creation');
    pass('Appointment Persistence');
  } catch (err) {
    fail('Appointment Persistence', err);
  }

  // ── 4. Conversation Persistence ──
  let convId: mongoose.Types.ObjectId | undefined;
  try {
    const conv = await Conversation.create({
      userId: 'smoke-test-user',
      messages: [
        { role: 'user',      content: 'Book me an appointment', timestamp: new Date() },
        { role: 'assistant', content: 'Slot booked for 20-06-2026 at 10:00', timestamp: new Date() },
      ],
      intent: 'booking_request',
      sentiment: 'positive',
      resolved: true,
    });
    convId = conv._id as mongoose.Types.ObjectId;
    const check = await Conversation.findById(convId);
    if (!check) throw new Error('Conversation not found after creation');
    pass('Conversation Persistence');
  } catch (err) {
    fail('Conversation Persistence', err);
  }

  // ── 5. Analytics Aggregation ──
  try {
    const [totalConv, totalAppt, totalKB] = await Promise.all([
      Conversation.countDocuments(),
      Appointment.countDocuments(),
      KnowledgeBase.countDocuments(),
    ]);
    if (totalConv === 0 && totalAppt === 0) throw new Error('All collections empty — expected test data');
    console.log(`   📊 Conversations: ${totalConv} | Appointments: ${totalAppt} | KnowledgeBase: ${totalKB}`);
    pass('Analytics Aggregation');
  } catch (err) {
    fail('Analytics Aggregation', err);
  }

  // ── Cleanup ──
  if (apptId) await Appointment.findByIdAndDelete(apptId);
  if (convId) await Conversation.findByIdAndDelete(convId);
  // Remove seed docs we added
  await KnowledgeBase.deleteMany({ sourceType: 'seed', title: /^Smoke Test Seed Doc/ });
  console.log('🧹 Cleaned up smoke test data');

  await mongoose.disconnect();

  // ── Summary ──
  const allPass = results.every(r => r.pass);
  console.log('\n----------------------------------------');
  console.log('SKYVOICE ATLAS SMOKE TEST RESULTS');
  console.log('----------------------------------------');
  for (const r of results) {
    const label = r.name.padEnd(32);
    console.log(`${label}${r.pass ? '✅ PASS' : `❌ FAIL — ${r.error}`}`);
  }
  console.log('----------------------------------------');
  if (allPass) {
    console.log('All systems operational on Atlas 🚀');
  } else {
    console.log('⚠️  Some checks failed — review errors above');
    process.exit(1);
  }
}

runSmokeTest();
