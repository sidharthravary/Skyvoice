import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { ApiError } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import { trackLogin } from '../services/userSessionService';

const router = Router();

function signToken(userId: string, username: string, role: string): string {
  return jwt.sign(
    { userId, username, role },
    process.env.JWT_SECRET || 'skyvoice-dev-local-secret-key-12345',
    { expiresIn: '7d' }
  );
}

// POST /api/auth/login
router.post('/login', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new ApiError(400, 'Username and password are required');
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.socket.remoteAddress
            || 'unknown';

    // ── Admin login ────────────────────────────────────────────────────────────
    if (username === 'Admin') {
      let adminUser = await User.findOne({ username: 'Admin' });
      if (!adminUser) {
        const hash = await bcrypt.hash('Skyvoice', 10);
        adminUser = await User.create({ username: 'Admin', passwordHash: hash, role: 'admin' });
      }

      const isMatch = await bcrypt.compare(password, adminUser.passwordHash);
      if (!isMatch) throw new ApiError(401, 'Invalid credentials');

      adminUser.lastLogin = new Date();
      adminUser.loginHistory.push({ timestamp: new Date(), ip });
      await adminUser.save();

      const userId = String(adminUser._id);
      const fullName = adminUser.fullName || 'Admin';
      const token = signToken(userId, adminUser.username, adminUser.role);

      trackLogin(userId, adminUser.username, fullName).catch(() => {});

      return res.json({
        success: true, token, role: adminUser.role,
        username: adminUser.username, fullName,
      });
    }

    // ── Visitor auto-register / login ──────────────────────────────────────────
    let visitor = await User.findOne({ username });

    if (!visitor) {
      const hash = await bcrypt.hash(password, 10);
      visitor = await User.create({ username, passwordHash: hash, role: 'visitor' });
    } else {
      const isMatch = await bcrypt.compare(password, visitor.passwordHash);
      if (!isMatch) throw new ApiError(401, 'Invalid credentials');
    }

    visitor.lastLogin = new Date();
    visitor.loginHistory.push({ timestamp: new Date(), ip });
    await visitor.save();

    const userId = String(visitor._id);
    const fullName = visitor.fullName || visitor.username;
    const token = signToken(userId, visitor.username, visitor.role);

    trackLogin(userId, visitor.username, fullName).catch(() => {});

    return res.json({
      success: true, token, role: visitor.role,
      username: visitor.username, fullName,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register
router.post('/register', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, username, email, password } = req.body;

    if (!username || !email || !password) {
      throw new ApiError(400, 'Username, email, and password are required');
    }
    if (password.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters');
    }
    if (username === 'Admin') {
      throw new ApiError(400, 'That username is reserved');
    }

    const [existingUsername, existingEmail] = await Promise.all([
      User.findOne({ username }),
      User.findOne({ email }),
    ]);

    if (existingUsername) throw new ApiError(409, 'Username already taken');
    if (existingEmail)    throw new ApiError(409, 'Email already registered');

    const resolvedFullName = fullName?.trim() || username;
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName: resolvedFullName,
      username,
      email,
      passwordHash: hash,
      role: 'visitor',
    });

    const userId = String(user._id);
    const token = signToken(userId, user.username, user.role);

    trackLogin(userId, user.username, resolvedFullName).catch(() => {});

    return res.status(201).json({
      success: true, token, role: user.role,
      username: user.username, fullName: resolvedFullName,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new ApiError(401, 'No token provided');

    const token = authHeader.slice(7);
    let payload: { userId: string; username: string; role: string };
    try {
      payload = jwt.verify(
        token, process.env.JWT_SECRET || 'skyvoice-dev-local-secret-key-12345'
      ) as any;
    } catch {
      throw new ApiError(401, 'Invalid or expired token');
    }

    const user = await User.findById(payload.userId).select('-passwordHash -loginHistory');
    if (!user) throw new ApiError(404, 'User not found');

    res.json({
      success: true,
      data: {
        username: user.username,
        fullName: user.fullName || user.username,
        role:      user.role,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
