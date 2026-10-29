import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '../auth.js';
import type { AppContext } from '../context.js';
import { conflict, forbidden } from '../errors.js';
import { ok, parseBody, parseQuery } from '../http.js';
import { insertSampleData } from '../demoData.js';
import { getCalendar, getDashboard } from '../repos/dashboard.js';
import { exportUserData, getProfile, updateProfile } from '../repos/profile.js';
import { rangeQuery, updateProfileSchema } from '../schemas.js';

/** Profile, dashboard, calendar, sample data and account-level actions. */
export function accountRoutes({ db, config, storage }: AppContext) {
  const r = Router();

  r.get('/profile', async (req, res) => {
    res.json(ok(await getProfile(db, requireUser(req).id)));
  });

  r.patch('/profile', async (req, res) => {
    const user = requireUser(req);
    res.json(ok(await updateProfile(db, user.id, parseBody(updateProfileSchema, req))));
  });

  r.get('/profile/export', async (req, res) => {
    const user = requireUser(req);
    res.setHeader('Content-Disposition', 'attachment; filename="campus-bridge-export.json"');
    res.json(await exportUserData(db, user.id));
  });

  /** Delete every application, interview, activity row and resume the user owns. The profile stays. */
  r.delete('/profile/data', async (req, res) => {
    const user = requireUser(req);
    const { rows } = await db.query<{ storage_path: string }>('SELECT storage_path FROM resumes WHERE user_id = $1', [user.id]);
    await db.tx(async (q) => {
      await q.query('DELETE FROM applications WHERE user_id = $1', [user.id]);
      await q.query('DELETE FROM resumes WHERE user_id = $1', [user.id]);
    });
    let failed = 0;
    for (const row of rows) {
      try {
        await storage?.remove(row.storage_path);
      } catch (err) {
        failed += 1;
        console.error('Storage cleanup failed while deleting user data:', (err as Error).message);
      }
    }
    res.json(ok({ deletedResumeFiles: rows.length - failed, failedFileCleanups: failed }));
  });

  /** Delete the account: data, profile, and (when configured) the Supabase Auth user. */
  r.delete('/profile', async (req, res) => {
    const user = requireUser(req);
    if (user.isDemo) throw forbidden('The shared demo account cannot be deleted.');
    const { rows } = await db.query<{ storage_path: string }>('SELECT storage_path FROM resumes WHERE user_id = $1', [user.id]);
    await db.query('DELETE FROM profiles WHERE id = $1', [user.id]); // cascades to all owned rows
    let failedFiles = 0;
    for (const row of rows) {
      try {
        await storage?.remove(row.storage_path);
      } catch {
        failedFiles += 1;
      }
    }
    let authUserDeleted = false;
    if (config.supabaseUrl && config.supabaseServiceRoleKey) {
      const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false } });
      const { error } = await admin.auth.admin.deleteUser(user.id);
      authUserDeleted = !error;
      if (error) console.error('Supabase auth user deletion failed:', error.message);
    }
    res.json(ok({ dataDeleted: true, authUserDeleted, failedFileCleanups: failedFiles }));
  });

  r.get('/dashboard', async (req, res) => {
    res.json(ok(await getDashboard(db, requireUser(req).id)));
  });

  r.get('/calendar', async (req, res) => {
    const user = requireUser(req);
    const { from, to } = parseQuery(rangeQuery, req);
    res.json(ok(await getCalendar(db, user.id, from, to)));
  });

  r.post('/sample-data', async (req, res) => {
    const user = requireUser(req);
    const inserted = await db.tx(async (q) => {
      const existing = await q.query('SELECT 1 FROM applications WHERE user_id = $1 AND is_demo LIMIT 1', [user.id]);
      if (existing.rowCount) throw conflict('Sample data is already loaded. Remove it first to reload.');
      return insertSampleData(q, user.id);
    });
    res.status(201).json(ok({ inserted }));
  });

  r.delete('/sample-data', async (req, res) => {
    const user = requireUser(req);
    const { rowCount } = await db.query('DELETE FROM applications WHERE user_id = $1 AND is_demo', [user.id]);
    res.json(ok({ removed: rowCount ?? 0 }));
  });

  return r;
}
