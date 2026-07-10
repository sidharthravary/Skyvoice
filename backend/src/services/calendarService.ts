import { Appointment } from '../models/appointment.model';
import { sendEmail, getBookingConfirmationTemplate } from './emailService';

const googleClientId = process.env.GOOGLE_CLIENT_ID;

export interface CalendarSlot {
  time: string;
  available: boolean;
}

export async function getAvailableSlots(dateStr: string, timezone: string): Promise<CalendarSlot[]> {
  console.log(`[Calendar] Fetching available slots for ${dateStr} in ${timezone}`);
  
  // Base working hours slots
  const defaultSlots = [
    { time: '09:00', available: true },
    { time: '10:00', available: true },
    { time: '11:00', available: true },
    { time: '13:00', available: true },
    { time: '14:00', available: true },
    { time: '15:00', available: true },
    { time: '16:00', available: true },
  ];

  try {
    // Parse target date using UTC to avoid timezone shift
    let startOfDay: Date;
    let endOfDay: Date;

    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    } else {
      const targetDate = new Date(dateStr);
      startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    }

    // Fetch existing appointments on this date
    const booked = await Appointment.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'cancelled' },
    });

    const bookedTimes = booked.map(app => app.time);

    // Map through default slots and mark as unavailable if already booked
    return defaultSlots.map(slot => ({
      time: slot.time,
      available: !bookedTimes.includes(slot.time),
    }));
  } catch (error) {
    console.error('[Calendar] Error fetching slots:', error);
    return defaultSlots;
  }
}

export async function bookAppointment(params: {
  userId?: string;
  name: string;
  email: string;
  date: string;
  time: string;
  timezone: string;
  notes?: string;
}): Promise<any> {
  const { userId, name, email, date, time, timezone, notes } = params;
  console.log(`[Calendar] Booking appointment for ${name} (${email}) on ${date} at ${time}`);

  // Create appointment in MongoDB
  const calendarEventId = `gcal_${Math.random().toString(36).substring(2, 15)}`;
  
  let parsedDate: Date;
  const dateParts = date.split('-');
  if (dateParts.length === 3) {
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const year = parseInt(dateParts[2]);
    parsedDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  } else {
    parsedDate = new Date(date);
  }

  const appointment = await Appointment.create({
    userId: userId || 'anonymous',
    name,
    email,
    date: parsedDate,
    time,
    calendarEventId,
    timezone,
    notes,
    status: 'confirmed',
  });
  console.log(`💾 [Appointment] saved to Atlas: ${appointment._id}`);

  // Send confirmation email
  const htmlBody = getBookingConfirmationTemplate(name, date, time, timezone);
  await sendEmail({
    to: email,
    subject: 'SkyVoice: Your Appointment is Confirmed',
    html: htmlBody,
  });

  return appointment;
}

export async function rescheduleAppointment(
  eventId: string,
  newDate: string,
  newTime: string
): Promise<any> {
  console.log(`[Calendar] Rescheduling appointment ${eventId} to ${newDate} at ${newTime}`);

  let parsedDate: Date;
  const dateParts = newDate.split('-');
  if (dateParts.length === 3) {
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const year = parseInt(dateParts[2]);
    parsedDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  } else {
    parsedDate = new Date(newDate);
  }

  const appointment = await Appointment.findOneAndUpdate(
    { calendarEventId: eventId },
    { date: parsedDate, time: newTime, status: 'rescheduled' },
    { new: true }
  );

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  // Send update email if email exists
  if (appointment.email) {
    const htmlBody = getBookingConfirmationTemplate(
      appointment.name || 'Client',
      newDate,
      newTime,
      appointment.timezone || 'UTC'
    );
    await sendEmail({
      to: appointment.email,
      subject: 'SkyVoice: Your Appointment Has Been Rescheduled',
      html: htmlBody,
    });
  }

  return appointment;
}

export async function cancelAppointment(eventId: string): Promise<any> {
  console.log(`[Calendar] Cancelling appointment ${eventId}`);

  const appointment = await Appointment.findOneAndUpdate(
    { calendarEventId: eventId },
    { status: 'cancelled' },
    { new: true }
  );

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.email) {
    await sendEmail({
      to: appointment.email,
      subject: 'SkyVoice: Your Appointment Has Been Cancelled',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #F5F9FF; padding: 20px; border-radius: 12px;">
          <h2 style="color: #EF4444; margin-bottom: 10px;">Appointment Cancelled</h2>
          <p>Hello <strong>${appointment.name}</strong>,</p>
          <p>Your appointment on <strong>${appointment.date.toDateString()}</strong> at <strong>${appointment.time}</strong> has been cancelled.</p>
        </div>
      `,
    });
  }

  return appointment;
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function parseNaturalDate(text: string): string {
  const query = text.toLowerCase().trim();
  const today = new Date();

  // 1. DD-MM-YYYY pattern match (matches user preference first)
  const matchDDMMYYYY = query.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (matchDDMMYYYY) {
    const d = matchDDMMYYYY[1].padStart(2, '0');
    const m = matchDDMMYYYY[2].padStart(2, '0');
    const y = matchDDMMYYYY[3];
    return `${d}-${m}-${y}`;
  }

  // 2. YYYY-MM-DD pattern match (converts year first format to DD-MM-YYYY)
  const matchYYYYMMDD = query.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (matchYYYYMMDD) {
    const y = matchYYYYMMDD[1];
    const m = matchYYYYMMDD[2].padStart(2, '0');
    const d = matchYYYYMMDD[3].padStart(2, '0');
    return `${d}-${m}-${y}`;
  }

  // 3. DD-MM pattern match (default to current year, e.g. "28-05")
  const matchShort = query.match(/\b(\d{1,2})[-/](\d{1,2})\b/);
  if (matchShort) {
    const d = matchShort[1].padStart(2, '0');
    const m = matchShort[2].padStart(2, '0');
    return `${d}-${m}-${today.getFullYear()}`;
  }
  
  // 4. today
  if (query.includes('today')) {
    return formatDate(today);
  }
  
  // 5. tomorrow
  if (query.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    return formatDate(tomorrow);
  }
  
  // 6. Next [DayOfWeek] or [DayOfWeek]
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < 7; i++) {
    const dayName = daysOfWeek[i];
    if (query.includes(dayName)) {
      const targetDay = i;
      const currentDay = today.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) {
        diff += 7; // nearest day of week
      }
      
      // If user says "next [day]", check if it naturally falls in this week (targetDay > currentDay)
      // If it falls within this week, they mean the day of the next week, so we add 7 days!
      if (query.includes('next ' + dayName)) {
        if (targetDay > currentDay) {
          diff += 7;
        }
      }
      
      const targetDate = new Date();
      targetDate.setDate(today.getDate() + diff);
      return formatDate(targetDate);
    }
  }

  // 7. Month + Day pattern (e.g., "may 28th", "june 10", "28th of may")
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  for (let m = 0; m < 12; m++) {
    const monthName = months[m];
    if (query.includes(monthName)) {
      const numbers = query.match(/\d+/g) || [];
      const dayNumStr = numbers.find(n => {
        const val = parseInt(n);
        return val >= 1 && val <= 31 && n.length <= 2;
      });
      if (dayNumStr) {
        const day = parseInt(dayNumStr);
        const targetDate = new Date(today.getFullYear(), m, day);
        if (targetDate < today) {
          targetDate.setFullYear(today.getFullYear() + 1);
        }
        return formatDate(targetDate);
      }
    }
  }

  // Default fallback: return tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  return formatDate(tomorrow);
}

export function parseNaturalTime(text: string): string {
  let query = text.toLowerCase().trim();

  // Map word numbers to digits for voice friendliness
  const wordToNum: { [key: string]: string } = {
    one: '1', two: '2', three: '3', four: '4', five: '5',
    six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
    eleven: '11', twelve: '12'
  };
  for (const [word, num] of Object.entries(wordToNum)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    query = query.replace(regex, num);
  }

  // Remove spaces around am/pm or colons to normalize
  query = query.replace(/\s+/g, '');
  
  // Look for patterns like "10am", "10pm", "10:30am", "10:30", "10"
  const timeMatch = query.match(/(\d{1,2})(?::(\d{2}))?(am|pm)?/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] || '00';
    const ampm = timeMatch[3];

    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    } else if (!ampm) {
      // Smart business hours fallback: if hour is 1-5, assume PM
      if (hours >= 1 && hours <= 5) {
        hours += 12;
      }
    }

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  return '09:00';
}
