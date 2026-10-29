import type { Db } from '../db.js';
import { notFound } from '../errors.js';
import type { UpdateProfileInput } from '../schemas.js';

const PROFILE_SELECT = `
  id, email, full_name AS "fullName", university, department, graduation_year AS "graduationYear",
  preferences, created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function getProfile(db: Db, userId: string) {
  const { rows } = await db.query(`SELECT ${PROFILE_SELECT} FROM profiles WHERE id = $1`, [userId]);
  if (!rows[0]) throw notFound('Profile');
  return rows[0];
}

export async function updateProfile(db: Db, userId: string, input: UpdateProfileInput) {
  const cols: Record<string, string> = {
    fullName: 'full_name',
    university: 'university',
    department: 'department',
    graduationYear: 'graduation_year',
    preferences: 'preferences',
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(input) as (keyof UpdateProfileInput)[]) {
    const value = input[key];
    if (value === undefined) continue;
    params.push(key === 'preferences' ? JSON.stringify(value) : value);
    sets.push(`${cols[key]} = $${params.length}${key === 'preferences' ? '::jsonb' : ''}`);
  }
  params.push(userId);
  await db.query(`UPDATE profiles SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return getProfile(db, userId);
}

/** Everything the user owns, for the "export my data" action. */
export async function exportUserData(db: Db, userId: string) {
  const [profile, applications, interviews, activity, resumes] = await Promise.all([
    getProfile(db, userId),
    db.query('SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at', [userId]),
    db.query('SELECT * FROM interviews WHERE user_id = $1 ORDER BY scheduled_at', [userId]),
    db.query('SELECT * FROM application_activity WHERE user_id = $1 ORDER BY created_at', [userId]),
    db.query(
      'SELECT id, name, original_filename, mime_type, size_bytes, created_at FROM resumes WHERE user_id = $1 ORDER BY created_at',
      [userId],
    ),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile,
    applications: applications.rows,
    interviews: interviews.rows,
    activity: activity.rows,
    resumes: resumes.rows,
    note: 'Resume PDF files are not included in this export; download them from the Resumes page.',
  };
}
