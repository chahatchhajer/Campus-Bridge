import type { Queryable } from '../db.js';

export type ActivityType =
  | 'created'
  | 'updated'
  | 'stage_changed'
  | 'interview_added'
  | 'interview_updated'
  | 'interview_removed'
  | 'resume_attached'
  | 'note';

export async function logActivity(
  q: Queryable,
  a: { applicationId: string; userId: string; type: ActivityType; message: string; metadata?: Record<string, unknown> },
) {
  await q.query(
    `INSERT INTO application_activity (application_id, user_id, type, message, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [a.applicationId, a.userId, a.type, a.message, JSON.stringify(a.metadata ?? {})],
  );
}
