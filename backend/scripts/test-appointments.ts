import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import './setup-dns';
import mongoose from 'mongoose';
import { Appointment } from '../src/models/appointment.model';

async function testAppointments() {
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
  console.log('✅ Connected to Atlas');

  try {
    // 1. Create test appointment
    // The model stores date as Date; calendarService converts DD-MM-YYYY → Date.
    // We use Date.UTC to replicate that same conversion.
    const testDate = new Date(Date.UTC(2026, 5, 20, 0, 0, 0)); // 20-06-2026

    const appt = await Appointment.create({
      userId: 'test-user-001',
      name: 'Test Visitor',
      email: 'test@skyviontech.com',
      date: testDate,
      time: '14:00',
      status: 'confirmed',
      notes: 'Test booking from connection verification',
    });
    console.log(`✅ [1] Created appointment: ${appt._id}`);

    // 2. Query back all appointments for that date
    const dayStart = new Date(Date.UTC(2026, 5, 20, 0, 0, 0));
    const dayEnd   = new Date(Date.UTC(2026, 5, 20, 23, 59, 59, 999));
    const found = await Appointment.find({ date: { $gte: dayStart, $lte: dayEnd } });
    console.log(`✅ [2] Found ${found.length} appointment(s) on 20-06-2026`);
    found.forEach(a => console.log(`     - ${a.name} at ${a.time} [${a.status}]`));

    // 3. Update status to cancelled
    await Appointment.findByIdAndUpdate(appt._id, { $set: { status: 'cancelled' } });
    console.log(`✅ [3] Updated appointment status to "cancelled"`);

    // 4. Confirm update persisted
    const updated = await Appointment.findById(appt._id);
    if (updated?.status !== 'cancelled') {
      throw new Error(`Expected "cancelled", got "${updated?.status}"`);
    }
    console.log(`✅ [4] Confirmed status is "cancelled": ${updated.status}`);

    // 5. Cleanup test data
    await Appointment.findByIdAndDelete(appt._id);
    console.log(`🧹 Cleaned up test appointment`);

    console.log('\n✅ Appointment CRUD verified on Atlas');
  } catch (err) {
    console.error('❌ Appointment test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected cleanly');
  }
}

testAppointments();
