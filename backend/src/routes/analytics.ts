import { Router, Request, Response, NextFunction } from 'express';
import { Conversation } from '../models/conversation.model';
import { Appointment } from '../models/appointment.model';
import { ProjectInquiry } from '../models/projectInquiry.model';
import { User } from '../models/user.model';

const router = Router();

// Week-over-week change in percent; null when there is no prior data to
// compare against (the UI hides the trend chip rather than inventing one).
function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

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

    // ── Real metrics computed from stored data ────────────────────────────────
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const prevWindow = { $gte: fourteenDaysAgo, $lt: sevenDaysAgo };

    // Total user queries = user-role messages across all conversations
    const queryCountAgg = await Conversation.aggregate([
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'user' } },
      { $count: 'total' },
    ]);
    const totalQueries = queryCountAgg[0]?.total ?? 0;

    // Average AI response time: gap between each user message and the
    // assistant reply that follows it, over the 50 most recent conversations
    // (gaps > 60s are treated as new sessions, not response latency).
    const recentConvs = await Conversation.find({}, { messages: 1 })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    const gaps: number[] = [];
    for (const conv of recentConvs) {
      const msgs = (conv.messages ?? []) as Array<{ role: string; timestamp?: Date }>;
      for (let i = 0; i < msgs.length - 1; i++) {
        if (msgs[i].role === 'user' && msgs[i + 1].role === 'assistant' && msgs[i].timestamp && msgs[i + 1].timestamp) {
          const gap = new Date(msgs[i + 1].timestamp!).getTime() - new Date(msgs[i].timestamp!).getTime();
          // <200ms means the messages were batch-stamped at save time
          // (pre-timestamping conversations), not a real response gap
          if (gap >= 200 && gap <= 60_000) gaps.push(gap);
        }
      }
    }
    const averageResponseTime = gaps.length > 0
      ? `${(gaps.reduce((a, b) => a + b, 0) / gaps.length / 1000).toFixed(1)}s`
      : null;

    // Week-over-week trends (current 7 days vs the 7 days before)
    const [convsCur, convsPrev, apptsCur, apptsPrev, usersCur, usersPrev, posCur, posPrev, curWindowConvs, prevWindowConvs] =
      await Promise.all([
        Conversation.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        Conversation.countDocuments({ createdAt: prevWindow }),
        Appointment.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        Appointment.countDocuments({ createdAt: prevWindow }),
        User.countDocuments({ lastLogin: { $gte: sevenDaysAgo } }),
        User.countDocuments({ lastLogin: prevWindow }),
        Conversation.countDocuments({ createdAt: { $gte: sevenDaysAgo }, sentiment: 'positive' }),
        Conversation.countDocuments({ createdAt: prevWindow, sentiment: 'positive' }),
        Conversation.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        Conversation.countDocuments({ createdAt: prevWindow }),
      ]);

    const activeUsers = usersCur;

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
        totalQueries,
        activeUsers,
        averageResponseTime,
        trends: {
          conversations: pctChange(convsCur, convsPrev),
          bookings: pctChange(apptsCur, apptsPrev),
          queries: pctChange(convsCur, convsPrev),
          users: pctChange(usersCur, usersPrev),
          satisfaction:
            curWindowConvs > 0 && prevWindowConvs > 0
              ? pctChange(
                  Math.round((posCur / curWindowConvs) * 100),
                  Math.round((posPrev / prevWindowConvs) * 100)
                )
              : null,
        },
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
