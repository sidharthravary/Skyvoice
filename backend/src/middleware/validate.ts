import { ZodType } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from './errorHandler';

// Validates req.body against a zod schema. On success the body is replaced
// with the parsed result, so unknown keys are stripped — this also protects
// endpoints that pass the body straight into Mongoose from mass assignment.
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      next(new ApiError(400, `Invalid request — ${details}`));
      return;
    }
    req.body = result.data;
    next();
  };
}
