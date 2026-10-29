import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Authentication required.') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to this resource.') => new HttpError(403, 'forbidden', message);
export const notFound = (what = 'Resource') => new HttpError(404, 'not_found', `${what} not found.`);
export const conflict = (message: string) => new HttpError(409, 'conflict', message);

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`Route ${req.method} ${req.path}`));
};

export function createErrorHandler(opts: { log: boolean }): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (res.headersSent) return;

    if (err instanceof HttpError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'validation_failed',
          message: 'Some fields are invalid.',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
      return;
    }
    // Malformed JSON, oversized bodies, etc. from body-parser / multer
    const anyErr = err as { type?: string; status?: number; code?: string };
    if (anyErr.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'invalid_json', message: 'Request body is not valid JSON.' } });
      return;
    }
    if (anyErr.type === 'entity.too.large' || anyErr.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: { code: 'payload_too_large', message: 'The request is too large.' } });
      return;
    }
    if (anyErr.code === 'LIMIT_UNEXPECTED_FILE' || anyErr.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({ error: { code: 'bad_upload', message: 'Upload one PDF in the "file" field.' } });
      return;
    }
    // Postgres: invalid text representation (e.g. malformed uuid) is a client error.
    if (anyErr.code === '22P02') {
      res.status(400).json({ error: { code: 'bad_request', message: 'A value has an invalid format.' } });
      return;
    }

    if (opts.log) console.error(`[${req.method} ${req.path}]`, err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong on our side.' } });
  };
}
