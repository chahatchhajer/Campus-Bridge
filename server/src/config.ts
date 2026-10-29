import dotenv from 'dotenv';
import { z } from 'zod';

/** Fixed identity used only when DEMO_MODE=true. Never derived from client input. */
export const DEMO_USER_ID = '00000000-0000-4000-8000-00000000d3a0';

const boolish = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z.enum(['true', 'false']).optional(),
  CLIENT_ORIGIN: z.string().optional(),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('resumes'),
  DEMO_MODE: boolish,
  ALLOW_PUBLIC_DEMO: boolish,
  HEALTH_CHECK_TOKEN: z.string().optional(),
  LOCAL_STORAGE_DIR: z.string().default('.data/uploads'),
  STORAGE_SIGNING_SECRET: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  databaseUrl: string | undefined;
  databaseSsl: boolean;
  clientOrigins: string[];
  supabaseUrl: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  supabaseJwtSecret: string | undefined;
  storageBucket: string;
  demoMode: boolean;
  healthCheckToken: string | undefined;
  localStorageDir: string;
  storageSigningSecret: string | undefined;
  trustProxy: number;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';

  const clientOrigins = (e.CLIENT_ORIGIN ?? (isProduction ? '' : 'http://localhost:5173'))
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (isProduction && clientOrigins.length === 0) {
    throw new Error('CLIENT_ORIGIN must be set in production (explicit frontend origin for CORS).');
  }
  if (isProduction && clientOrigins.includes('*')) {
    throw new Error('CLIENT_ORIGIN must not be a wildcard in production.');
  }
  if (e.DEMO_MODE && isProduction && !e.ALLOW_PUBLIC_DEMO) {
    throw new Error(
      'DEMO_MODE disables authentication and is refused in production. ' +
        'Set ALLOW_PUBLIC_DEMO=true only if you knowingly want a public, shared, unauthenticated demo.',
    );
  }

  const dbUrl = e.DATABASE_URL || undefined;
  const isLocalDb = !dbUrl || /@(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(dbUrl);

  return {
    env: e.NODE_ENV,
    isProduction,
    port: e.PORT,
    databaseUrl: dbUrl,
    databaseSsl: e.DATABASE_SSL ? e.DATABASE_SSL === 'true' : !isLocalDb,
    clientOrigins,
    supabaseUrl: e.SUPABASE_URL ? e.SUPABASE_URL.replace(/\/$/, '') : undefined,
    supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY || undefined,
    supabaseJwtSecret: e.SUPABASE_JWT_SECRET || undefined,
    storageBucket: e.SUPABASE_STORAGE_BUCKET,
    demoMode: e.DEMO_MODE,
    healthCheckToken: e.HEALTH_CHECK_TOKEN || undefined,
    localStorageDir: e.LOCAL_STORAGE_DIR,
    storageSigningSecret: e.STORAGE_SIGNING_SECRET || undefined,
    trustProxy: e.TRUST_PROXY,
  };
}

/** Load .env files (server/.env, then repo-root .env) before reading process.env. */
export function loadDotenv() {
  dotenv.config({ path: ['.env', '../.env'], quiet: true });
}
