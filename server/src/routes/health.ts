import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import type { AppContext } from '../context.js';
import { notFound, unauthorized } from '../errors.js';

function tokenMatches(given: string | undefined, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function healthRoutes({ db, config, storage }: AppContext) {
  const r = Router();

  /** Public liveness probe for Render. Reveals nothing about configuration. */
  r.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'campus-bridge-api', time: new Date().toISOString() });
  });

  /**
   * Deployment diagnostics. Disabled unless HEALTH_CHECK_TOKEN is set, and requires that token in the
   * `x-health-token` header. Returns only booleans, driver names, latency and Postgres error *codes*
   * (never connection strings, hostnames, keys or error messages).
   */
  r.get('/ready', async (req, res) => {
    if (!config.healthCheckToken) throw notFound('Route GET /api/health/ready');
    if (!tokenMatches(req.get('x-health-token'), config.healthCheckToken)) throw unauthorized('Invalid health token.');

    const started = Date.now();
    let database: { ok: boolean; latencyMs?: number; errorCode?: string };
    try {
      await db.query('SELECT 1');
      const tables = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name IN ('profiles','applications','interviews','resumes','application_activity')`,
      );
      database = { ok: tables.rows[0].n === 5, latencyMs: Date.now() - started };
      if (!database.ok) database.errorCode = 'migrations_missing';
    } catch (err) {
      database = { ok: false, errorCode: (err as { code?: string }).code ?? 'connection_failed' };
    }

    let storageStatus: { driver: string; ok: boolean };
    if (!storage) storageStatus = { driver: 'none', ok: false };
    else storageStatus = { driver: storage.kind, ok: await storage.probe().catch(() => false) };

    const healthy = database.ok && storageStatus.ok;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ready' : 'degraded',
      database,
      storage: storageStatus,
      auth: {
        mode: config.demoMode ? 'demo (insecure)' : config.supabaseUrl || config.supabaseJwtSecret ? 'supabase-jwt' : 'unconfigured',
        jwks: Boolean(config.supabaseUrl),
        hs256Configured: Boolean(config.supabaseJwtSecret),
      },
      cors: { originCount: config.clientOrigins.length },
      env: config.env,
    });
  });

  return r;
}
