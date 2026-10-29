/**
 * Seeds the fictional demo student.
 *
 *   npm run seed          Additive and repeatable: does nothing if the demo student already has sample data.
 *                         Never deletes anything.
 *   npm run seed:reset    DISPOSABLE LOCAL DEVELOPMENT ONLY. Deletes the demo student's rows, then re-seeds.
 *                         Refuses to run in production or without ALLOW_DESTRUCTIVE_SEED=yes. It only ever
 *                         touches the fixed demo user id, never other students' data.
 */
import { DEMO_USER_ID, loadConfig, loadDotenv } from '../src/config.js';
import { createDb } from '../src/db.js';
import { insertSampleData } from '../src/demoData.js';

loadDotenv();
const config = loadConfig();
const reset = process.argv.includes('--reset');

if (reset) {
  if (config.isProduction || process.env.ALLOW_DESTRUCTIVE_SEED !== 'yes') {
    console.error('[seed] --reset refused. It is for disposable local databases only.');
    console.error('       Set ALLOW_DESTRUCTIVE_SEED=yes (and do not run with NODE_ENV=production) to proceed.');
    process.exit(1);
  }
}

const db = createDb(config);
try {
  await db.tx(async (q) => {
    await q.query(
      `INSERT INTO profiles (id, email, full_name, university, department, graduation_year)
       VALUES ($1, 'demo@campus-bridge.invalid', 'Demo Student', 'Fictional State University', 'Computer Science', 2027)
       ON CONFLICT (id) DO NOTHING`,
      [DEMO_USER_ID],
    );
    if (reset) {
      await q.query('DELETE FROM applications WHERE user_id = $1', [DEMO_USER_ID]);
      await q.query('DELETE FROM resumes WHERE user_id = $1', [DEMO_USER_ID]);
      console.log('[seed] removed existing demo-student rows');
    }
    const existing = await q.query('SELECT 1 FROM applications WHERE user_id = $1 AND is_demo LIMIT 1', [DEMO_USER_ID]);
    if (existing.rowCount) {
      console.log('[seed] demo student already has sample data - nothing to do (use seed:reset on a disposable DB to rebuild).');
      return;
    }
    const n = await insertSampleData(q, DEMO_USER_ID);
    console.log(`[seed] inserted ${n} fictional applications for the demo student`);
  });
} catch (err) {
  console.error('[seed] failed:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await db.close();
}
