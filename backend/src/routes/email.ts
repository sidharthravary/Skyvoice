import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { adminOnly, AuthRequest } from '../middleware/auth';
import { sendEmail, getTestEmailTemplate, isEmailEnabled } from '../services/emailService';

const router = Router();

const testSchema = z.object({
  to: z.string().trim().email('A valid recipient email is required'),
});

// GET /api/email/status — is real sending configured?
router.get('/status', adminOnly, (_req, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: isEmailEnabled(),
      hint: isEmailEnabled()
        ? 'Emails are being sent for real.'
        : 'Set EMAIL_ENABLED=true plus SMTP_USER/SMTP_PASS in .env, then restart the backend.',
    },
  });
});

// POST /api/email/test — send a test email (admin only)
router.post('/test', adminOnly, validateBody(testSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ok = await sendEmail({
      to: req.body.to,
      subject: 'SkyVoice test email',
      html: getTestEmailTemplate(),
    });
    res.json({
      success: ok,
      enabled: isEmailEnabled(),
      message: isEmailEnabled()
        ? (ok ? `Test email sent to ${req.body.to} — check the inbox (and spam).` : 'SMTP send failed — check backend logs.')
        : 'Email is disabled — the message was logged to the backend console instead of being sent.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
