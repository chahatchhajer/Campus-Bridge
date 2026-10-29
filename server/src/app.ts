import cors from 'cors';
import express, { type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createAuthMiddleware, createTokenVerifier, type TokenVerifier } from './auth.js';
import type { AppContext } from './context.js';
import { createErrorHandler, notFoundHandler } from './errors.js';
import { accountRoutes } from './routes/account.js';
import { analyticsRoutes } from './routes/analytics.js';
import { applicationRoutes } from './routes/applications.js';
import { healthRoutes } from './routes/health.js';
import { interviewRoutes } from './routes/interviews.js';
import { resumeRoutes } from './routes/resumes.js';
import { LocalStorage } from './storage.js';

export function createApp(ctx: AppContext, opts: { verifier?: TokenVerifier | null; logErrors?: boolean; rateLimit?: boolean } = {}) {
  const { config } = ctx;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const allowed = new Set(config.clientOrigins);
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Health-Token'],
      maxAge: 600,
    }),
  );

  const useLimits = opts.rateLimit ?? config.env !== 'test';
  const passthrough: RequestHandler = (_req, _res, next) => next();
  const limiter = (windowMs: number, limit: number): RequestHandler =>
    useLimits
      ? rateLimit({
          windowMs,
          limit,
          standardHeaders: 'draft-7',
          legacyHeaders: false,
          message: { error: { code: 'rate_limited', message: 'Too many requests. Please slow down and try again shortly.' } },
        })
      : passthrough;

  app.use(limiter(60_000, 300));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRoutes(ctx));

  // Signed local-dev file URLs are authorised by their HMAC signature, not by a session.
  if (ctx.storage instanceof LocalStorage) {
    const local = ctx.storage;
    app.get('/api/files/local', (req, res) => {
      const q = req.query as Record<string, string>;
      const file = local.verifyLocal({ p: String(q.p ?? ''), exp: String(q.exp ?? ''), d: String(q.d ?? ''), n: String(q.n ?? ''), sig: String(q.sig ?? '') });
      if (!file) {
        res.status(403).json({ error: { code: 'forbidden', message: 'This download link is invalid or has expired.' } });
        return;
      }
      const filename = String(q.n ?? 'resume.pdf').replace(/[^\w.\- ]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `${q.d === 'attachment' ? 'attachment' : 'inline'}; filename="${filename}"`);
      res.sendFile(file, (err) => {
        if (err && !res.headersSent) res.status(404).json({ error: { code: 'not_found', message: 'File not found.' } });
      });
    });
  }

  const verifier = opts.verifier === undefined ? createTokenVerifier(config) : opts.verifier;
  const authenticate = createAuthMiddleware(config, ctx.db, verifier);
  const uploadLimiter = limiter(15 * 60_000, 30);

  const api = express.Router();
  api.use(authenticate);
  api.use('/applications', applicationRoutes(ctx));
  api.use('/interviews', interviewRoutes(ctx));
  api.use('/resumes', resumeRoutes(ctx, uploadLimiter));
  api.use('/analytics', analyticsRoutes(ctx));
  api.use('/', accountRoutes(ctx));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(createErrorHandler({ log: opts.logErrors ?? config.env !== 'test' }));
  return app;
}
