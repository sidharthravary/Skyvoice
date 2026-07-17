import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserSession } from '../models/userSession.model';
import { ApiError } from '../middleware/errorHandler';

const router = Router();
import { JWT_SECRET } from '../middleware/auth';

function requireAuth(req: Request): { userId: string; role: string } {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'Authentication required');
  const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: string; role: string };
  return payload;
}

// GET /api/users/sessions/all — admin only, summary of all users
router.get('/sessions/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = requireAuth(req);
    if (role !== 'admin') throw new ApiError(403, 'Admin access required');

    const sessions = await UserSession.find({})
      .select('userId username fullName totalSessions totalMessages totalBookings lastActive firstLogin')
      .sort({ lastActive: -1 })
      .limit(100);

    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:userId/session — full session document
router.get('/:userId/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId: requesterId, role } = requireAuth(req);
    const { userId } = req.params;

    if (role !== 'admin' && requesterId !== userId) {
      throw new ApiError(403, 'Access denied');
    }

    const session = await UserSession.findOne({ userId });
    if (!session) return res.json({ success: true, data: null });

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:userId/activity — paginated activityLog
router.get('/:userId/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId: requesterId, role } = requireAuth(req);
    const { userId } = req.params;

    if (role !== 'admin' && requesterId !== userId) {
      throw new ApiError(403, 'Access denied');
    }

    const type   = req.query.type as string | undefined;
    const limit  = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const page   = parseInt(req.query.page as string) || 1;

    const session = await UserSession.findOne({ userId }).select('activityLog');
    if (!session) return res.json({ success: true, data: [], total: 0 });

    let log = [...session.activityLog].reverse();
    if (type) log = log.filter(e => e.type === type);

    const total = log.length;
    const paginated = log.slice((page - 1) * limit, page * limit);

    res.json({ success: true, data: paginated, total, page, limit });
  } catch (error) {
    next(error);
  }
});

export default router;
