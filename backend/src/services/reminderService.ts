import { Appointment } from '../models/appointment.model';
import { User } from '../models/user.model';
import { sendEmail, getBookingReminderTemplate, isEmailEnabled } from './emailService';

// Day-before appointment reminders. Checks hourly; at REMINDER_HOUR (default
// 8 AM server time) it emails every confirmed booking for tomorrow, once per
// day. Entirely dormant while EMAIL_ENABLED is off.

const REMINDER_HOUR = parseInt(process.env.REMINDER_HOUR || '8');
let lastRunDay = '';

export async function sendDueReminders(now = new Date()): Promise<number> {
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

  const appointments = await Appointment.find({
    status: 'confirmed',
    date: { $gte: tomorrowStart, $lt: tomorrowEnd },
  }).lean();

  let sent = 0;
  for (const appt of appointments) {
    const user = await User.findById(appt.userId).select('email').catch(() => null);
    if (!user?.email) continue;
    const ok = await sendEmail({
      to: user.email,
      subject: `Reminder: your appointment tomorrow at ${appt.time}`,
      html: getBookingReminderTemplate(
        appt.visitorName || appt.name,
        new Date(appt.date).toDateString(),
        appt.time
      ),
    });
    if (ok) sent++;
  }
  return sent;
}

export function startReminderScheduler(): void {
  setInterval(async () => {
    if (!isEmailEnabled()) return; // dormant until email is turned on
    const now = new Date();
    const today = now.toDateString();
    if (now.getHours() !== REMINDER_HOUR || lastRunDay === today) return;
    lastRunDay = today;
    try {
      const sent = await sendDueReminders(now);
      console.log(`[Reminders] Sent ${sent} day-before reminder(s)`);
    } catch (err) {
      console.error('[Reminders] Failed:', err);
    }
  }, 60 * 60 * 1000); // hourly check
  console.log(`[Reminders] Scheduler armed (fires at ${REMINDER_HOUR}:00 when email is enabled)`);
}
