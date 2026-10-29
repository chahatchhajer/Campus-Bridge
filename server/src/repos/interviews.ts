import type { Db } from '../db.js';
import { notFound } from '../errors.js';
import { todayIso } from '../http.js';
import type { CreateInterviewInput, UpdateInterviewInput } from '../schemas.js';
import { logActivity } from './activity.js';

const ROUND_LABELS: Record<string, string> = {
  phone_screen: 'Phone screen',
  technical: 'Technical',
  behavioral: 'Behavioral',
  hr: 'HR',
  onsite: 'Onsite',
  other: 'Interview',
};

const INTERVIEW_SELECT = `
  i.id, i.application_id AS "applicationId", i.round_type AS "roundType", i.scheduled_at AS "scheduledAt",
  i.status, i.outcome, i.notes, i.created_at AS "createdAt", i.updated_at AS "updatedAt"`;

export async function createInterview(db: Db, userId: string, applicationId: string, input: CreateInterviewInput) {
  return db.tx(async (q) => {
    const app = (
      await q.query(`SELECT company, stage, applied_date FROM applications WHERE id = $1 AND user_id = $2 FOR UPDATE`, [
        applicationId,
        userId,
      ])
    ).rows[0];
    if (!app) throw notFound('Application');

    const { rows } = await q.query(
      `INSERT INTO interviews (application_id, user_id, round_type, scheduled_at, status, outcome, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [applicationId, userId, input.roundType, input.scheduledAt, input.status ?? 'scheduled', input.outcome ?? 'pending', input.notes ?? ''],
    );
    await logActivity(q, {
      applicationId,
      userId,
      type: 'interview_added',
      message: `Scheduled ${ROUND_LABELS[input.roundType]} round`,
      metadata: { interviewId: rows[0].id, scheduledAt: input.scheduledAt },
    });

    // Booking an interview implies the application has progressed to the interview stage.
    let advanced = false;
    if (['saved', 'applied', 'assessment'].includes(app.stage)) {
      await q.query(
        `UPDATE applications
            SET stage = 'interview', stage_updated_at = now(), applied_date = COALESCE(applied_date, $3::date)
          WHERE id = $1 AND user_id = $2`,
        [applicationId, userId, todayIso()],
      );
      await logActivity(q, {
        applicationId,
        userId,
        type: 'stage_changed',
        message: `Moved from ${app.stage[0].toUpperCase()}${app.stage.slice(1)} to Interview (interview scheduled)`,
        metadata: { from: app.stage, to: 'interview', automatic: true },
      });
      advanced = true;
    }
    return { id: rows[0].id as string, advanced };
  });
}

export async function getInterview(db: Db, userId: string, id: string) {
  const { rows } = await db.query(`SELECT ${INTERVIEW_SELECT} FROM interviews i WHERE i.id = $1 AND i.user_id = $2`, [id, userId]);
  if (!rows[0]) throw notFound('Interview');
  return rows[0];
}

const UPDATABLE: Record<keyof UpdateInterviewInput, string> = {
  roundType: 'round_type',
  scheduledAt: 'scheduled_at',
  status: 'status',
  outcome: 'outcome',
  notes: 'notes',
};

export async function updateInterview(db: Db, userId: string, id: string, input: UpdateInterviewInput) {
  await db.tx(async (q) => {
    const cur = (await q.query('SELECT * FROM interviews WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, userId])).rows[0];
    if (!cur) throw notFound('Interview');

    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of Object.keys(input) as (keyof UpdateInterviewInput)[]) {
      const value = input[key];
      if (value === undefined) continue;
      params.push(value);
      sets.push(`${UPDATABLE[key]} = $${params.length}`);
    }
    params.push(id, userId);
    await q.query(`UPDATE interviews SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND user_id = $${params.length}`, params);

    const parts: string[] = [];
    if (input.status && input.status !== cur.status) parts.push(`status ${input.status}`);
    if (input.outcome && input.outcome !== cur.outcome) parts.push(`outcome ${input.outcome}`);
    if (input.scheduledAt) parts.push('rescheduled');
    await logActivity(q, {
      applicationId: cur.application_id,
      userId,
      type: 'interview_updated',
      message: `${ROUND_LABELS[input.roundType ?? cur.round_type]} round: ${parts.join(', ') || 'details updated'}`,
      metadata: { interviewId: id },
    });
  });
}

export async function deleteInterview(db: Db, userId: string, id: string) {
  await db.tx(async (q) => {
    const { rows } = await q.query(
      'DELETE FROM interviews WHERE id = $1 AND user_id = $2 RETURNING application_id, round_type',
      [id, userId],
    );
    if (!rows[0]) throw notFound('Interview');
    await logActivity(q, {
      applicationId: rows[0].application_id,
      userId,
      type: 'interview_removed',
      message: `Removed ${ROUND_LABELS[rows[0].round_type]} round`,
      metadata: {},
    });
  });
}
