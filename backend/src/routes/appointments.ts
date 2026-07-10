import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Appointment } from '../models/appointment.model';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

function parseOptionalAuth(req: Request): { userId?: string; role?: string } {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return {};
    const token = header.slice(7);
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'skyvoice-dev-local-secret-key-12345'
    ) as { userId: string; role: string };
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
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await Appointment.create(req.body);
    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/appointments/:id — visitors can only cancel their own
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
