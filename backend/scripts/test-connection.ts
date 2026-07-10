import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import './setup-dns';
import mongoose from 'mongoose';

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
  }

  console.log(`🔌 Connecting to: ${uri.replace(/:([^@]+)@/, ':***@')}`);

  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB Atlas connected successfully');

    // Ping the database
    const adminDb = mongoose.connection.db!;
    const ping = await adminDb.command({ ping: 1 });
    console.log(`🏓 Ping result:`, ping);

    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🖥️  Host: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected cleanly');
  }
}

testConnection();
