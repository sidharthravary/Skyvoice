import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { ApiError } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import { trackLogin } from '../services/userSessionService';
import {
  setAuthCookies,
  clearAuthCookies,
  getTokenFromRequest,
  verifyToken,
} from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(64),
  password: z.string().min(1, 'Password is required').max(128),
});

const registerSchema = z.object({
  fullName: z.string().trim().max(100).optional(),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores'),
  email: z.string().trim().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

function signToken(userId: string, username: string, role: string): string {
  return jwt.sign(
    { userId, username, role },
    process.env.JWT_SECRET || 'skyvoice-dev-local-secret-key-12345',
    { expiresIn: '7d' }
  );
}

// POST /api/auth/login
router.post('/login', rateLimiter, validateBody(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;

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

      setAuthCookies(req, res, token, { role: adminUser.role, username: adminUser.username, fullName });
      return res.json({
        success: true, role: adminUser.role,
        username: adminUser.username, fullName,
      });
    }

    // ── Visitor login — existing accounts only (registration is /register) ─────
    const visitor = await User.findOne({ username });

    if (!visitor) {
      // Same message as a wrong password so usernames can't be probed.
      throw new ApiError(401, 'Invalid username or password');
    }

    const isMatch = await bcrypt.compare(password, visitor.passwordHash);
    if (!isMatch) throw new ApiError(401, 'Invalid username or password');

    visitor.lastLogin = new Date();
    visitor.loginHistory.push({ timestamp: new Date(), ip });
    await visitor.save();

    const userId = String(visitor._id);
    const fullName = visitor.fullName || visitor.username;
    const token = signToken(userId, visitor.username, visitor.role);

    trackLogin(userId, visitor.username, fullName).catch(() => {});

    setAuthCookies(req, res, token, { role: visitor.role, username: visitor.username, fullName });
    return res.json({
      success: true, role: visitor.role,
      username: visitor.username, fullName,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register
router.post('/register', rateLimiter, validateBody(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, username, email, password } = req.body;

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

    setAuthCookies(req, res, token, { role: user.role, username: user.username, fullName: resolvedFullName });
    return res.status(201).json({
      success: true, role: user.role,
      username: user.username, fullName: resolvedFullName,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout — clears the HttpOnly auth cookie (JS can't)
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) throw new ApiError(401, 'No token provided');

    let payload: { userId: string; username: string; role: string };
    try {
      payload = verifyToken(token);
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
