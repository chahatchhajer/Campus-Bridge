import { createApp } from './app.js';
import { loadConfig, loadDotenv } from './config.js';
import { createDb } from './db.js';
import { createStorage, ensureStorageReady } from './storage.js';

loadDotenv();
const config = loadConfig();
const db = createDb(config);
const { driver: storage, reason } = createStorage(config);

const app = createApp({ config, db, storage });

const server = app.listen(config.port, () => {
  console.log(`Campus Bridge API listening on :${config.port} (${config.env})`);
  console.log(`  storage: ${reason}`);
  if (config.demoMode) {
    console.warn('  WARNING: DEMO_MODE is on. Authentication is bypassed and every visitor shares one account. Not secure.');
  } else if (!config.supabaseUrl && !config.supabaseJwtSecret) {
    console.warn('  WARNING: no SUPABASE_URL / SUPABASE_JWT_SECRET configured - every authenticated request will be rejected.');
  }
  console.log(`  CORS origins: ${config.clientOrigins.join(', ') || '(none)'}`);
});

ensureStorageReady(storage).catch((err: Error) => console.error(`Storage setup problem: ${err.message}`));
db.query('SELECT 1').catch((err: { code?: string }) =>
  console.error(`Database not reachable at startup (code: ${err.code ?? 'unknown'}). Check DATABASE_URL.`),
);

const shutdown = () => {
  server.close(() => db.close().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
