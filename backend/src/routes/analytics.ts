import { Router, Request, Response, NextFunction } from 'express';
import { Conversation } from '../models/conversation.model';
import { Appointment } from '../models/appointment.model';
import { ProjectInquiry } from '../models/projectInquiry.model';

const router = Router();

// GET /api/analytics — Dashboard summary stats
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalConversations,
      activeConversations,
      resolvedConversations,
      totalAppointments,
      confirmedAppointments,
      totalInquiries,
      newInquiries,
    ] = await Promise.all([
      Conversation.countDocuments(),
      Conversation.countDocuments({ resolved: false }),
      Conversation.countDocuments({ resolved: true }),
      Appointment.countDocuments(),
      Appointment.countDocuments({ status: 'confirmed' }),
      ProjectInquiry.countDocuments(),
      ProjectInquiry.countDocuments({ status: 'new' }),
    ]);

    const bookingSuccessRate = totalAppointments > 0
      ? Math.round((confirmedAppointments / totalAppointments) * 100)
      : 0;

    const resolutionRate = totalConversations > 0
      ? Math.round((resolvedConversations / totalConversations) * 100)
      : 0;

    // Sentiment breakdown
    const sentimentCounts = await Conversation.aggregate([
      { $group: { _id: '$sentiment', count: { $sum: 1 } } },
    ]);

    const sentimentMap: Record<string, number> = {};
    sentimentCounts.forEach((s) => { sentimentMap[s._id] = s.count; });

    const satisfactionScore = totalConversations > 0
      ? Math.round(((sentimentMap['positive'] || 0) / totalConversations) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        totalConversations,
        activeConversations,
        bookingSuccessRate,
        satisfactionScore,
        resolutionRate,
        totalAppointments,
        totalInquiries,
        newInquiries,
        averageResponseTime: '1.2s', // TODO: Compute from actual data
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/trends — Conversation trends over time
router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const trends = await Conversation.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%d-%m-%Y', date: '$createdAt' } },
          count: { $sum: 1 },
          resolved: { $sum: { $cond: ['$resolved', 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: trends });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/bookings — Booking metrics
router.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const bookingTrends = await Appointment.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%d-%m-%Y', date: '$createdAt' } },
          total: { $sum: 1 },
          confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: bookingTrends });
  } catch (error) {
    next(error);
  }
});

export default router;
