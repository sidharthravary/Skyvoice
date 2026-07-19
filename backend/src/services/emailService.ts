import nodemailer from 'nodemailer';

// Email is OFF until EMAIL_ENABLED=true AND real SMTP credentials are set in
// .env. Until then every send is a harmless console log, so all the wiring
// (booking confirmations, cancellations, reminders) is in place and dormant.

const emailFrom = () => process.env.EMAIL_FROM || 'noreply@skyviontech.com';

export function isEmailEnabled(): boolean {
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  return (
    process.env.EMAIL_ENABLED === 'true' &&
    user.length > 0 &&
    pass.length > 0 &&
    !user.includes('placeholder') &&
    !pass.includes('placeholder')
  );
}

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (!isEmailEnabled()) return null;
  if (!transporter) {
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const mailOptions = {
    from: emailFrom(),
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  const smtp = getTransporter();
  if (smtp) {
    try {
      await smtp.sendMail(mailOptions);
      console.log(`[Email] ✅ Sent "${options.subject}" to ${options.to}`);
      return true;
    } catch (error) {
      console.error('[Email] Failed to send email via SMTP:', error);
      return false;
    }
  }

  // Disabled / no credentials — log instead of sending
  console.log('\n📧 ─────────── [EMAIL DISABLED — would have sent] ───────────');
  console.log(`FROM:    ${mailOptions.from}`);
  console.log(`TO:      ${options.to}`);
  console.log(`SUBJECT: ${options.subject}`);
  console.log('(set EMAIL_ENABLED=true + SMTP credentials in .env to send for real)');
  console.log('─────────────────────────────────────────────────────────────\n');
  return true;
}

export function getBookingConfirmationTemplate(name: string, date: string, time: string, timezone: string): string {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #F5F9FF; padding: 20px; border-radius: 12px;">
      <h2 style="color: #4F7DF3; margin-bottom: 10px;">SkyVoice Appointment Confirmed</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your voice scheduling session has successfully booked an appointment on our calendar.</p>
      <div style="background-color: white; border: 1px solid #E2E8F0; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 5px 0;">📅 <strong>Date:</strong> ${date}</p>
        <p style="margin: 5px 0;">⏰ <strong>Time:</strong> ${time}</p>
        <p style="margin: 5px 0;">🌐 <strong>Timezone:</strong> ${timezone}</p>
      </div>
      <p>If you need to reschedule or cancel, you can do so by calling back or via the dashboard.</p>
      <p style="font-size: 12px; color: #94A3B8; margin-top: 20px;">Powered by SKYVION AI Voice Operations Platform</p>
    </div>
  `;
}

export function getBookingCancellationTemplate(name: string, date: string, time: string): string {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #F5F9FF; padding: 20px; border-radius: 12px;">
      <h2 style="color: #EF4444; margin-bottom: 10px;">SkyVoice Appointment Cancelled</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your appointment has been cancelled:</p>
      <div style="background-color: white; border: 1px solid #E2E8F0; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 5px 0;">📅 <strong>Date:</strong> ${date}</p>
        <p style="margin: 5px 0;">⏰ <strong>Time:</strong> ${time}</p>
      </div>
      <p>If this wasn't intended, simply book a new slot with the SkyVoice assistant.</p>
      <p style="font-size: 12px; color: #94A3B8; margin-top: 20px;">Powered by SKYVION AI Voice Operations Platform</p>
    </div>
  `;
}

export function getBookingReminderTemplate(name: string, date: string, time: string): string {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #F5F9FF; padding: 20px; border-radius: 12px;">
      <h2 style="color: #4F7DF3; margin-bottom: 10px;">Reminder: your appointment is tomorrow</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>A friendly reminder about your upcoming appointment with Skyvion Technologies:</p>
      <div style="background-color: white; border: 1px solid #E2E8F0; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 5px 0;">📅 <strong>Date:</strong> ${date}</p>
        <p style="margin: 5px 0;">⏰ <strong>Time:</strong> ${time}</p>
      </div>
      <p>Need to reschedule? Just tell the SkyVoice assistant.</p>
      <p style="font-size: 12px; color: #94A3B8; margin-top: 20px;">Powered by SKYVION AI Voice Operations Platform</p>
    </div>
  `;
}

export function getTestEmailTemplate(): string {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #F5F9FF; padding: 20px; border-radius: 12px;">
      <h2 style="color: #4F7DF3; margin-bottom: 10px;">SkyVoice email is working 🎉</h2>
      <p>This is a test message from your SkyVoice platform.</p>
      <p>Booking confirmations, cancellations, and day-before reminders will be delivered just like this one.</p>
      <p style="font-size: 12px; color: #94A3B8; margin-top: 20px;">Powered by SKYVION AI Voice Operations Platform</p>
    </div>
  `;
}

export function getProjectInquiryTemplate(companyName: string, requirements: string, budget: string, timeline: string, email: string): string {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #F5F9FF; padding: 20px; border-radius: 12px;">
      <h2 style="color: #4F7DF3; margin-bottom: 10px;">New Project Inquiry Captured</h2>
      <p>A new client lead was generated by the SkyVoice AI Assistant.</p>
      <div style="background-color: white; border: 1px solid #E2E8F0; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 5px 0;">🏢 <strong>Company Name:</strong> ${companyName}</p>
        <p style="margin: 5px 0;">✉️ <strong>Client Email:</strong> ${email}</p>
        <p style="margin: 5px 0;">💼 <strong>Timeline:</strong> ${timeline}</p>
        <p style="margin: 5px 0;">💰 <strong>Budget Range:</strong> ${budget}</p>
        <p style="margin: 10px 0 5px 0;">📝 <strong>Requirements:</strong></p>
        <div style="background-color: #F8FAFC; padding: 10px; border-radius: 4px; font-size: 14px; border-left: 3px solid #4F7DF3;">
          ${requirements}
        </div>
      </div>
      <p style="font-size: 12px; color: #94A3B8; margin-top: 20px;">Lead saved in SkyVoice MongoDB system</p>
    </div>
  `;
}
