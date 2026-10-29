/**
 * Starts a throwaway local PostgreSQL (no Docker or system install needed) for development and
 * visual review, applies migrations, and keeps running until Ctrl+C.
 *
 *   npm run dev:db        then set DATABASE_URL=postgres://postgres:postgres@localhost:54329/campus_bridge
 *
 * Data lives in server/.devdb (git-ignored). This is a development convenience, not a deployment path.
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';
import { createDb } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';

const PORT = Number(process.env.DEV_DB_PORT ?? 54329);
const dir = path.resolve('.devdb');
const fresh = !existsSync(path.join(dir, 'PG_VERSION'));

const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: PORT, persistent: true });
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('campus_bridge');

const url = `postgres://postgres:postgres@localhost:${PORT}/campus_bridge`;
const db = createDb({ databaseUrl: url, databaseSsl: false });
await runMigrations(db, (m) => console.log(`[dev-db] ${m}`));
await db.close();

console.log(`[dev-db] ready. DATABASE_URL=${url}`);
console.log('[dev-db] press Ctrl+C to stop');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => undefined, 1 << 30);
