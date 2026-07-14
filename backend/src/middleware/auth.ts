import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export const AUTH_COOKIE = 'skyvoice_token';

const JWT_SECRET = process.env.JWT_SECRET || 'skyvoice-dev-local-secret-key-12345';

// Minimal cookie-header parser (avoids a cookie-parser dependency).
export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name) cookies[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return cookies;
}

// The JWT lives in an HttpOnly cookie (primary). A Bearer header is still
// accepted as a fallback for API clients / scripts.
export function getTokenFromRequest(req: Request): string | null {
  const cookieToken = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  return null;
}

export function verifyToken(token: string): { userId: string; username: string; role: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
}

// Sets the auth cookies on a login/register response:
// - skyvoice_token: HttpOnly (not readable by page JavaScript)
// - role/username/fullname: readable, display + client-side routing only
export function setAuthCookies(
  req: Request,
  res: Response,
  token: string,
  meta: { role: string; username: string; fullName: string }
): void {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.secure;
  const maxAge = 7 * 24 * 60 * 60 * 1000; // match the JWT's 7d expiry
  const base = { sameSite: 'lax' as const, secure, path: '/', maxAge };

  res.cookie(AUTH_COOKIE, token, { ...base, httpOnly: true });
  res.cookie('skyvoice_role', meta.role, base);
  res.cookie('skyvoice_username', meta.username, base);
  res.cookie('skyvoice_fullname', meta.fullName, base);
}

export function clearAuthCookies(res: Response): void {
  for (const name of [AUTH_COOKIE, 'skyvoice_role', 'skyvoice_username', 'skyvoice_fullname']) {
    res.clearCookie(name, { path: '/' });
  }
}

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const token = getTokenFromRequest(req);
    if (!token) throw new ApiError(401, 'Authentication required');

    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(401, 'Invalid or expired token'));
    }
  }
}
