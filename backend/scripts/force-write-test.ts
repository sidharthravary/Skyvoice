/**
 * Atlas write verification script.
 * Run from the backend/ directory:
 *   npx tsx scripts/force-write-test.ts
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import dns from 'dns';
import mongoose from 'mongoose';

const DNS_SERVERS = (process.env.DNS_SERVERS || '192.168.1.1,8.8.8.8,1.1.1.1').split(',').map(s => s.trim()).filter(Boolean);
dns.setServers(DNS_SERVERS);

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set — check that .env loaded correctly');
  process.exit(1);
}

const isAtlas = MONGODB_URI.includes('mongodb+srv');
const maskedUri = MONGODB_URI.replace(/:([^:@]+)@/, ':***@');
console.log(`[test] URI → ${maskedUri}`);
console.log(`[test] Atlas: ${isAtlas}`);

const TestSchema = new mongoose.Schema({
  label:     { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const TestDoc = mongoose.model('WriteTest', TestSchema);

async function run() {
  try {
    console.log('[test] Connecting…');
    await mongoose.connect(MONGODB_URI);

    const { host, name } = mongoose.connection;
    console.log(`[test] Connected — host: ${host}, db: ${name}`);

    const label = `write-test-${Date.now()}`;
    const doc = await TestDoc.create({ label });
    console.log(`[test] Wrote document → _id: ${doc._id}, label: ${doc.label}`);

    const found = await TestDoc.findById(doc._id);
    if (!found) throw new Error('Post-save read returned null — Atlas did NOT persist the document');
    console.log(`✅ Verified: document exists in Atlas (db: ${name})`);

    await TestDoc.deleteOne({ _id: doc._id });
    console.log('[test] Cleaned up test document');
  } catch (err) {
    console.error('❌ Test failed:', (err as Error).message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[test] Disconnected');
  }
}

run();
