import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader, type JWTVerifyGetKey } from 'jose';
import { DEMO_USER_ID, type Config } from './config.js';
import type { Db } from './db.js';
import { unauthorized } from './errors.js';

export type AuthUser = { id: string; email: string | null; isDemo: boolean };

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TokenVerifier = (token: string) => Promise<{ id: string; email: string | null }>;

/**
 * Verifies Supabase-issued access tokens.
 *  - Asymmetric signing keys (current Supabase default): verified against the project's JWKS.
 *  - Legacy HS256 shared secret: verified with SUPABASE_JWT_SECRET (backend only).
 * Issuer and audience are always checked. The user id is the token's `sub`;
 * nothing the client sends in the body, query or other headers is used for identity.
 */
export function createTokenVerifier(config: Config): TokenVerifier | null {
  if (!config.supabaseUrl && !config.supabaseJwtSecret) return null;

  const issuer = config.supabaseUrl ? `${config.supabaseUrl}/auth/v1` : undefined;
  const jwks: JWTVerifyGetKey | undefined = config.supabaseUrl
    ? createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`), { cooldownDuration: 30_000 })
    : undefined;
  const secret = config.supabaseJwtSecret ? new TextEncoder().encode(config.supabaseJwtSecret) : undefined;

  return async (token) => {
    const { alg } = decodeProtectedHeader(token);
    const base = { audience: 'authenticated', ...(issuer ? { issuer } : {}) };
    let payload;
    if (alg === 'HS256') {
      if (!secret) throw new Error('HS256 token but no SUPABASE_JWT_SECRET configured');
      ({ payload } = await jwtVerify(token, secret, { ...base, algorithms: ['HS256'] }));
    } else {
      if (!jwks) throw new Error('Asymmetric token but SUPABASE_URL is not configured');
      ({ payload } = await jwtVerify(token, jwks, { ...base, algorithms: ['ES256', 'RS256', 'EdDSA'] }));
    }
    const sub = payload.sub;
    if (!sub || !UUID_RE.test(sub)) throw new Error('Token subject is not a UUID');
    return { id: sub, email: typeof payload.email === 'string' ? payload.email : null };
  };
}

/** Ensures a profile row exists for the authenticated user (once per process per user). */
function createProfileEnsurer(db: Db) {
  const known = new Set<string>();
  return async (user: AuthUser) => {
    if (known.has(user.id)) return;
    await db.query(
      `INSERT INTO profiles (id, email, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.email, user.isDemo ? 'Demo Student' : ''],
    );
    known.add(user.id);
    if (known.size > 5000) known.clear();
  };
}

export function createAuthMiddleware(config: Config, db: Db, verify: TokenVerifier | null): RequestHandler {
  const ensureProfile = createProfileEnsurer(db);

  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization;
      let user: AuthUser;

      if (header) {
        const match = /^Bearer\s+(.+)$/i.exec(header);
        if (!match) throw unauthorized('Malformed Authorization header.');
        if (!verify) throw unauthorized('Token verification is not configured on this server.');
        try {
          const identity = await verify(match[1]);
          user = { ...identity, isDemo: false };
        } catch {
          throw unauthorized('Invalid or expired session. Please sign in again.');
        }
      } else if (config.demoMode) {
        // INSECURE demo identity: a fixed server-side user, never derived from client input.
        user = { id: DEMO_USER_ID, email: 'demo@campus-bridge.invalid', isDemo: true };
      } else {
        throw unauthorized();
      }

      await ensureProfile(user);
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireUser(req: { user?: AuthUser }): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
