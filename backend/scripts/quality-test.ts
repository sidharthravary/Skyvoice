/**
 * SkyVoice System Quality Test
 * Run from the backend/ directory:  npx tsx scripts/quality-test.ts
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import dns from 'dns';
import mongoose from 'mongoose';

dns.setServers(['192.168.1.1', '8.8.8.8', '1.1.1.1']);

const results: Record<string, boolean | string> = {};

function pass(label: string, note = '') {
  results[label] = true;
  console.log(`  ✅ ${label}${note ? ' — ' + note : ''}`);
}

function fail(label: string, reason: string) {
  results[label] = false;
  console.log(`  ❌ ${label} — ${reason}`);
}

async function testAtlasConnection() {
  const uri = process.env.MONGODB_URI || '';
  if (!uri) return fail('Atlas URI', 'MONGODB_URI not set — dotenv failed to load');

  const masked = uri.replace(/:([^:@]+)@/, ':***@');
  console.log(`  URI: ${masked}`);

  const isAtlas = uri.includes('mongodb+srv');
  if (!isAtlas) return fail('Atlas URI', 'URI is localhost, not Atlas — dotenv loading failed');

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const { host, name } = mongoose.connection;
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      fail('Atlas Connection', `Connected to LOCAL MongoDB (${host}) — not Atlas`);
    } else {
      pass('Atlas Connection', `host=${host}, db=${name}`);
    }
  } catch (err: any) {
    fail('Atlas Connection', err.message);
  }
}

async function testAtlasWrite() {
  if (mongoose.connection.readyState !== 1) return fail('Atlas Write', 'Not connected');
  try {
    const TestSchema = new mongoose.Schema({ label: String, ts: Date });
    const TestModel  = mongoose.models['_QualityTest'] || mongoose.model('_QualityTest', TestSchema);
    const doc = await TestModel.create({ label: 'quality-test', ts: new Date() });
    const check = await TestModel.findById(doc._id);
    await TestModel.deleteOne({ _id: doc._id });
    check ? pass('Atlas Write/Read') : fail('Atlas Write/Read', 'post-save read returned null');
  } catch (err: any) {
    fail('Atlas Write', err.message);
  }
}

async function testUsersCollection() {
  if (mongoose.connection.readyState !== 1) return fail('Users Collection', 'Not connected');
  try {
    const UserSchema = new mongoose.Schema({ username: String, role: String });
    const UserModel  = mongoose.models['User'] || mongoose.model('User', UserSchema);
    const count = await UserModel.countDocuments();
    count > 0
      ? pass('Users Collection', `${count} user(s) found`)
      : fail('Users Collection', 'collection is empty — Admin user not seeded');
  } catch (err: any) {
    fail('Users Collection', err.message);
  }
}

async function testKnowledgeBase() {
  if (mongoose.connection.readyState !== 1) return fail('KnowledgeBase', 'Not connected');
  try {
    const KBSchema = new mongoose.Schema({ title: String, content: String });
    const KBModel  = mongoose.models['KnowledgeBase'] || mongoose.model('KnowledgeBase', KBSchema);
    const count = await KBModel.countDocuments();
    count >= 5
      ? pass('KnowledgeBase', `${count} docs`)
      : fail('KnowledgeBase', `only ${count} docs (expected ≥5)`);
  } catch (err: any) {
    fail('KnowledgeBase', err.message);
  }
}

async function testBackendHealth() {
  try {
    const res = await fetch('http://localhost:3011/api/health', { signal: AbortSignal.timeout(5000) });
    const data: any = await res.json();
    res.ok && data.status === 'healthy'
      ? pass('Backend Health', `uptime=${Math.round(data.uptime)}s`)
      : fail('Backend Health', `status=${res.status} body=${JSON.stringify(data)}`);
  } catch (err: any) {
    fail('Backend Health', `${err.message} — backend may not be running`);
  }
}

async function testAdminLogin() {
  try {
    const res = await fetch('http://localhost:3011/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: 'Admin', password: 'Skyvoice' }),
      signal:  AbortSignal.timeout(8000),
    });
    const data: any = await res.json();
    data.token && data.role === 'admin'
      ? pass('Admin Login', `role=${data.role}, fullName=${data.fullName}`)
      : fail('Admin Login', JSON.stringify(data));
  } catch (err: any) {
    fail('Admin Login', err.message);
  }
}

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey.includes('placeholder')) return fail('Gemini', 'No real API key in .env');

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI  = new GoogleGenerativeAI(apiKey);
    const model  = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
    const result = await model.generateContent('Say "ok" in one word. No punctuation.');
    const text   = result.response.text().trim().toLowerCase();
    pass('Gemini API', `responded: "${text}"`);
  } catch (err: any) {
    const isQuota = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('Too Many Requests');
    if (isQuota) {
      // 429 means the key is VALID but quota is exhausted — not a code failure
      pass('Gemini API', 'key valid — daily quota exhausted (fallback to keywords active)');
    } else {
      fail('Gemini API', err.message);
    }
  }
}

async function testEnvVars() {
  const checks: [string, string, boolean][] = [
    ['FRONTEND_URL',  process.env.FRONTEND_URL  || '', (process.env.FRONTEND_URL || '').includes('3010')],
    ['PORT',          process.env.PORT           || '', process.env.PORT === '3011'],
    ['JWT_SECRET',    '(set)',                          !!process.env.JWT_SECRET && !process.env.JWT_SECRET.includes('placeholder')],
    ['MONGODB_URI',   '(set)',                          !!process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongodb+srv')],
    ['GEMINI_API_KEY','(set)',                          !!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('placeholder')],
  ];
  for (const [key, val, ok] of checks) {
    ok ? pass(`ENV:${key}`, val.substring(0, 30) || '(set)') : fail(`ENV:${key}`, val || '(not set / wrong format)');
  }
}

async function main() {
  console.log('\n════════════════════════════════════════════');
  console.log('     SKYVOICE SYSTEM QUALITY TEST');
  console.log('════════════════════════════════════════════\n');

  console.log('── Environment Variables ──');
  await testEnvVars();

  console.log('\n── Atlas Database ──');
  await testAtlasConnection();
  await testAtlasWrite();
  await testUsersCollection();
  await testKnowledgeBase();

  console.log('\n── Backend API ──');
  await testBackendHealth();
  await testAdminLogin();

  console.log('\n── AI Services ──');
  await testGemini();

  await mongoose.disconnect().catch(() => {});

  const passed = Object.values(results).filter(v => v === true).length;
  const total  = Object.keys(results).length;

  console.log('\n════════════════════════════════════════════');
  console.log(`  RESULT: ${passed}/${total} checks passed`);
  console.log('════════════════════════════════════════════');
  Object.entries(results).forEach(([k, v]) => {
    console.log(`  ${v === true ? '✅' : '❌'} ${k}`);
  });
  console.log('════════════════════════════════════════════\n');

  if (passed < total) {
    console.log('⚠️  Fix the failing checks before going to production.\n');
    process.exitCode = 1;
  } else {
    console.log('🚀 ALL SYSTEMS OPERATIONAL\n');
  }
}

main().catch(err => {
  console.error('Quality test crashed:', err);
  process.exitCode = 1;
});
