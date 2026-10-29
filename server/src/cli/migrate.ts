import { loadConfig, loadDotenv } from '../config.js';
import { createDb } from '../db.js';
import { runMigrations } from '../migrate.js';

loadDotenv();
const db = createDb(loadConfig());
try {
  await runMigrations(db, (m) => console.log(`[migrate] ${m}`));
} catch (err) {
  console.error('[migrate] failed:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await db.close();
}
