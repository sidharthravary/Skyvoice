import { Router, Request, Response, NextFunction } from 'express';
import { Appointment } from '../models/appointment.model';
import { ApiError } from '../middleware/errorHandler';
import { getTokenFromRequest, verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

const statusEnum = z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no-show']);

async function notifyCancellation(appt: {
  userId: string;
  name: string;
  visitorName?: string;
  date: Date;
  time: string;
}): Promise<void> {
  const { User } = await import('../models/user.model');
  const { sendEmail, getBookingCancellationTemplate } = await import('../services/emailService');
  const user = await User.findById(appt.userId).select('email').catch(() => null);
  if (!user?.email) return;
  const dateStr = new Date(appt.date).toDateString();
  await sendEmail({
    to: user.email,
    subject: `Appointment cancelled — ${dateStr} at ${appt.time}`,
    html: getBookingCancellationTemplate(appt.visitorName || appt.name, dateStr, appt.time),
  });
}

const createAppointmentSchema = z.object({
  userId: z.string().trim().min(1).max(64),
  visitorName: z.string().trim().max(100).optional(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email().max(254).optional(),
  date: z.coerce.date(),
  time: z.string().trim().min(1).max(20),
  timezone: z.string().trim().max(64).optional(),
  status: statusEnum.optional(),
  notes: z.string().trim().max(2000).optional(),
});

// PATCH allows only these fields — everything else is stripped
const updateAppointmentSchema = z
  .object({
    status: statusEnum.optional(),
    date: z.coerce.date().optional(),
    time: z.string().trim().min(1).max(20).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No updatable fields provided' });

function parseOptionalAuth(req: Request): { userId?: string; role?: string } {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return {};
    const payload = verifyToken(token);
    return { userId: payload.userId, role: payload.role };
  } catch {
    return {};
  }
}

// GET /api/appointments — admin gets all; visitor gets only their own
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status    = req.query.status as string;
    const startDate = req.query.startDate as string;
    const endDate   = req.query.endDate as string;

    const { userId, role } = parseOptionalAuth(req);

    const filter: Record<string, unknown> = {};
    if (role === 'visitor' && userId) filter.userId = userId;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) (filter.date as Record<string, unknown>).$gte = new Date(startDate);
      if (endDate)   (filter.date as Record<string, unknown>).$lte = new Date(endDate);
    }

    const total = await Appointment.countDocuments(filter);
    const appointments = await Appointment.find(filter)
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: appointments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/appointments/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) throw new ApiError(404, 'Appointment not found');
    res.json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
});

// POST /api/appointments
router.post('/', validateBody(createAppointmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await Appointment.create(req.body);
    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/appointments/:id — visitors can only cancel their own
router.patch('/:id', validateBody(updateAppointmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, role } = parseOptionalAuth(req);

    const existing = await Appointment.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'Appointment not found');

    if (role === 'visitor' && userId && existing.userId !== userId) {
      throw new ApiError(403, 'You do not have permission to modify this appointment');
    }

    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    // Cancellation email (non-blocking; no-op until EMAIL_ENABLED is on)
    if (appointment && req.body.status === 'cancelled' && existing.status !== 'cancelled') {
      notifyCancellation(appointment).catch((err) =>
        console.error('[Email] Cancellation notice failed:', err)
      );
    }

    res.json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) throw new ApiError(404, 'Appointment not found');
    res.json({ success: true, message: 'Appointment deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
