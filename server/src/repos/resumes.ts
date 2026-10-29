import type { Db, Queryable } from '../db.js';
import { notFound } from '../errors.js';

const RESUME_SELECT = `
  r.id, r.name, r.original_filename AS "originalFilename", r.size_bytes AS "sizeBytes",
  r.mime_type AS "mimeType", r.created_at AS "createdAt", r.updated_at AS "updatedAt",
  (SELECT count(*)::int FROM applications a WHERE a.resume_id = r.id) AS "applicationCount"`;

export const MAX_RESUMES_PER_USER = 20;

export async function listResumes(db: Queryable, userId: string) {
  const { rows } = await db.query(`SELECT ${RESUME_SELECT} FROM resumes r WHERE r.user_id = $1 ORDER BY r.created_at DESC`, [userId]);
  return rows;
}

export async function countResumes(db: Queryable, userId: string) {
  return (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM resumes WHERE user_id = $1', [userId])).rows[0].n;
}

export async function insertResume(
  db: Queryable,
  r: { id: string; userId: string; name: string; originalFilename: string; storagePath: string; sizeBytes: number },
) {
  await db.query(
    `INSERT INTO resumes (id, user_id, name, original_filename, storage_path, mime_type, size_bytes)
     VALUES ($1,$2,$3,$4,$5,'application/pdf',$6)`,
    [r.id, r.userId, r.name, r.originalFilename, r.storagePath, r.sizeBytes],
  );
  return getResume(db, r.userId, r.id);
}

export async function getResume(db: Queryable, userId: string, id: string) {
  const { rows } = await db.query(`SELECT ${RESUME_SELECT} FROM resumes r WHERE r.id = $1 AND r.user_id = $2`, [id, userId]);
  if (!rows[0]) throw notFound('Resume');
  return rows[0];
}

/** Internal lookup that includes the storage path. Always scoped to the owner. */
export async function getResumeStorage(db: Queryable, userId: string, id: string) {
  const { rows } = await db.query<{ storagePath: string; originalFilename: string; name: string }>(
    `SELECT storage_path AS "storagePath", original_filename AS "originalFilename", name
       FROM resumes WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (!rows[0]) throw notFound('Resume');
  return rows[0];
}

export async function renameResume(db: Db, userId: string, id: string, name: string) {
  const { rowCount } = await db.query('UPDATE resumes SET name = $3 WHERE id = $1 AND user_id = $2', [id, userId, name]);
  if (!rowCount) throw notFound('Resume');
  return getResume(db, userId, id);
}

/** Deletes the metadata row and returns the storage path so the caller can remove the object. */
export async function deleteResumeRow(db: Db, userId: string, id: string) {
  const { rows } = await db.query<{ storagePath: string }>(
    'DELETE FROM resumes WHERE id = $1 AND user_id = $2 RETURNING storage_path AS "storagePath"',
    [id, userId],
  );
  if (!rows[0]) throw notFound('Resume');
  return rows[0].storagePath;
}
