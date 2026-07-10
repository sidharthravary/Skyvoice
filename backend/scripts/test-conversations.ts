import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import './setup-dns';
import mongoose from 'mongoose';
import { Conversation } from '../src/models/conversation.model';

async function testConversations() {
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
  console.log('✅ Connected to Atlas');

  try {
    // 1. Create test conversation with 2 messages
    const conv = await Conversation.create({
      userId: 'test-user-conv-001',
      messages: [
        { role: 'user',      content: 'I want to book an appointment',                           timestamp: new Date() },
        { role: 'assistant', content: 'I found a slot on Friday at 2 PM. Does that work?',       timestamp: new Date() },
      ],
      intent: 'booking_request',
      sentiment: 'positive',
      resolved: false,
    });
    console.log(`✅ [1] Created conversation: ${conv._id}`);

    // 2. Query back by intent filter
    const found = await Conversation.find({ intent: 'booking_request', userId: 'test-user-conv-001' });
    console.log(`✅ [2] Found ${found.length} conversation(s) with intent "booking_request"`);

    // 3. Mark as resolved
    await Conversation.findByIdAndUpdate(conv._id, { $set: { resolved: true } });
    console.log(`✅ [3] Marked conversation as resolved`);

    // 4. Confirm update persisted
    const updated = await Conversation.findById(conv._id);
    if (!updated?.resolved) {
      throw new Error(`Expected resolved=true, got ${updated?.resolved}`);
    }
    console.log(`✅ [4] Confirmed resolved=true`);

    // 5. Cleanup
    await Conversation.findByIdAndDelete(conv._id);
    console.log(`🧹 Cleaned up test conversation`);

    console.log('\n✅ Conversation CRUD verified on Atlas');
  } catch (err) {
    console.error('❌ Conversation test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected cleanly');
  }
}

testConversations();
