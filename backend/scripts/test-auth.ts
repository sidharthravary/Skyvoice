import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import './setup-dns';
import mongoose from 'mongoose';

async function testAuth() {
  const uri = process.env.MONGODB_URI!;
  console.log('URI:', uri.replace(/:([^@]+)@/, ':***@'));

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected!');
    await mongoose.disconnect();
  } catch (err: any) {
    console.error('❌ Failed:', err.message);
    // Try without authSource
    console.log('Retrying without authSource...');
    const uriNoAuth = uri.replace('&authSource=admin', '').replace('?authSource=admin', '');
    try {
      await mongoose.connect(uriNoAuth, { serverSelectionTimeoutMS: 10000 });
      console.log('✅ Connected without authSource!');
      await mongoose.disconnect();
    } catch (err2: any) {
      console.error('❌ Also failed without authSource:', err2.message);
    }
  }
}

testAuth();
