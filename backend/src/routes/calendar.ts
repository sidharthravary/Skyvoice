import { Router, Request, Response, NextFunction } from 'express';
import { getAvailableSlots, bookAppointment, rescheduleAppointment, cancelAppointment } from '../services/calendarService';

const router = Router();

// GET /api/calendar/slots — Get available time slots
router.get('/slots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const timezone = req.query.timezone as string || 'UTC';

    const slots = await getAvailableSlots(date, timezone);
    res.json({ success: true, data: { date, timezone, slots } });
  } catch (error) {
    next(error);
  }
});

// POST /api/calendar/book — Book an appointment
router.post('/book', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, date, time, timezone, notes, userId } = req.body;

    const appointment = await bookAppointment({
      userId,
      name,
      email,
      date,
      time,
      timezone: timezone || 'UTC',
      notes,
    });

    res.status(201).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/calendar/reschedule/:eventId
router.patch('/reschedule/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const { newDate, newTime } = req.body;

    const appointment = await rescheduleAppointment(eventId as string, newDate as string, newTime as string);
    res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/calendar/cancel/:eventId
router.delete('/cancel/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;

    const appointment = await cancelAppointment(eventId as string);
    res.json({ success: true, message: `Event ${eventId} cancelled`, data: appointment });
  } catch (error) {
    next(error);
  }
});

export default router;
