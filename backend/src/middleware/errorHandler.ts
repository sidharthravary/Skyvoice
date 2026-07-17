import { Request, Response, NextFunction } from 'express';
import { captureError } from '../services/sentryService';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';

  console.error(`[Error] ${statusCode} — ${err.message}`);
  if (!err.isOperational) {
    console.error(err.stack);
    captureError(err); // reported to Sentry when SENTRY_DSN is configured
  }

  // Stack traces only for unexpected errors, and never in production —
  // expected 4xx responses (bad login, validation) stay clean everywhere.
  const includeStack = process.env.NODE_ENV !== 'production' && !err.isOperational;
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(includeStack && { stack: err.stack }),
  });
}

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
