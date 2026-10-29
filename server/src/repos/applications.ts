import type { Db, Queryable } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { escapeLike, todayIso } from '../http.js';
import {
  SORT_COLUMNS,
  type CreateApplicationInput,
  type ListApplicationsQuery,
  type Stage,
  type UpdateApplicationInput,
} from '../schemas.js';
import { logActivity } from './activity.js';

export const STAGE_LABELS: Record<Stage, string> = {
  saved: 'Saved',
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

const APP_SELECT = `
  a.id, a.company, a.sector, a.job_title AS "jobTitle", a.job_type AS "jobType", a.role_type AS "roleType",
  a.location, a.source, a.stage, a.applied_date AS "appliedDate", a.deadline, a.notes,
  a.resume_id AS "resumeId", a.is_demo AS "isDemo",
  a.stage_updated_at AS "stageUpdatedAt", a.created_at AS "createdAt", a.updated_at AS "updatedAt"`;

const LIST_EXTRAS = `,
  (SELECT count(*)::int FROM interviews i WHERE i.application_id = a.id) AS "interviewCount",
  (SELECT min(i.scheduled_at) FROM interviews i
     WHERE i.application_id = a.id AND i.status = 'scheduled' AND i.scheduled_at >= now()) AS "nextInterviewAt"`;

/** Application column for each input key. Only these names are ever interpolated into SQL. */
const UPDATABLE: Record<keyof UpdateApplicationInput, string> = {
  company: 'company',
  jobTitle: 'job_title',
  jobType: 'job_type',
  roleType: 'role_type',
  sector: 'sector',
  location: 'location',
  source: 'source',
  stage: 'stage',
  appliedDate: 'applied_date',
  deadline: 'deadline',
  notes: 'notes',
  resumeId: 'resume_id',
};

async function assertResumeOwned(q: Queryable, userId: string, resumeId: string | null | undefined) {
  if (!resumeId) return;
  const { rowCount } = await q.query('SELECT 1 FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, userId]);
  if (!rowCount) throw badRequest('The selected resume was not found.');
}

export async function listApplications(db: Db, userId: string, f: ListApplicationsQuery) {
  const params: unknown[] = [userId];
  const where = ['a.user_id = $1'];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };

  if (f.search) add(`(a.company ILIKE ? ESCAPE '\\' OR a.job_title ILIKE ? ESCAPE '\\')`, `%${escapeLike(f.search)}%`);
  if (f.stage) add('a.stage = ?', f.stage);
  if (f.jobType) add('a.job_type = ?', f.jobType);
  if (f.from) add('COALESCE(a.applied_date, a.created_at::date) >= ?::date', f.from);
  if (f.to) add('COALESCE(a.applied_date, a.created_at::date) <= ?::date', f.to);

  const whereSql = where.join(' AND ');
  const total = (await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM applications a WHERE ${whereSql}`, params))
    .rows[0].count;

  const dir = f.order === 'asc' ? 'ASC' : 'DESC';
  const col = SORT_COLUMNS[f.sort];
  const { rows } = await db.query(
    `SELECT ${APP_SELECT}${LIST_EXTRAS}
       FROM applications a
      WHERE ${whereSql}
      ORDER BY ${col} ${dir} NULLS LAST, a.created_at DESC, a.id
      LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}`,
    params,
  );
  return { rows, total };
}

export async function getApplicationDetail(db: Db, userId: string, id: string) {
  const { rows } = await db.query(
    `SELECT ${APP_SELECT}, r.name AS "resumeName"
       FROM applications a
       LEFT JOIN resumes r ON r.id = a.resume_id AND r.user_id = a.user_id
      WHERE a.id = $1 AND a.user_id = $2`,
    [id, userId],
  );
  if (!rows[0]) throw notFound('Application');

  const [interviews, activity] = await Promise.all([
    db.query(
      `SELECT id, application_id AS "applicationId", round_type AS "roundType", scheduled_at AS "scheduledAt",
              status, outcome, notes, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM interviews WHERE application_id = $1 AND user_id = $2 ORDER BY scheduled_at`,
      [id, userId],
    ),
    db.query(
      `SELECT id, type, message, metadata, created_at AS "createdAt"
         FROM application_activity WHERE application_id = $1 AND user_id = $2
        ORDER BY created_at DESC, id LIMIT 100`,
      [id, userId],
    ),
  ]);
  return { ...rows[0], interviews: interviews.rows, activity: activity.rows };
}

export async function createApplication(db: Db, userId: string, input: CreateApplicationInput, opts: { isDemo?: boolean } = {}) {
  return db.tx(async (q) => {
    await assertResumeOwned(q, userId, input.resumeId);
    const stage = input.stage ?? 'saved';
    const appliedDate = input.appliedDate ?? (stage === 'saved' ? null : todayIso());

    const { rows } = await q.query<{ id: string }>(
      `INSERT INTO applications
         (user_id, company, sector, job_title, job_type, role_type, location, source, stage,
          applied_date, deadline, notes, resume_id, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        userId,
        input.company,
        input.sector ?? 'Other',
        input.jobTitle,
        input.jobType ?? 'internship',
        input.roleType ?? 'engineering',
        input.location ?? '',
        input.source ?? '',
        stage,
        appliedDate,
        input.deadline ?? null,
        input.notes ?? '',
        input.resumeId ?? null,
        opts.isDemo ?? false,
      ],
    );
    const id = rows[0].id;
    await logActivity(q, {
      applicationId: id,
      userId,
      type: 'created',
      message: `Added ${input.company} - ${input.jobTitle} as ${STAGE_LABELS[stage]}`,
      metadata: { stage },
    });
    return id;
  });
}

export async function updateApplication(db: Db, userId: string, id: string, input: UpdateApplicationInput) {
  return db.tx(async (q) => {
    const cur = (
      await q.query(`SELECT * FROM applications WHERE id = $1 AND user_id = $2 FOR UPDATE`, [id, userId])
    ).rows[0];
    if (!cur) throw notFound('Application');
    if (input.resumeId !== undefined) await assertResumeOwned(q, userId, input.resumeId);

    const sets: string[] = [];
    const params: unknown[] = [];
    const changedFields: string[] = [];
    const push = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };

    for (const key of Object.keys(input) as (keyof UpdateApplicationInput)[]) {
      const value = input[key] as unknown;
      const col = UPDATABLE[key];
      if (!col || value === undefined) continue;
      if (cur[col] !== value) {
        push(col, value);
        if (key !== 'stage' && key !== 'resumeId') changedFields.push(key);
      }
    }

    const stageChanged = input.stage !== undefined && input.stage !== cur.stage;
    if (stageChanged) {
      sets.push('stage_updated_at = now()');
      // Leaving "saved" means the application was submitted; make sure it has an applied date.
      const effectiveApplied = input.appliedDate !== undefined ? input.appliedDate : cur.applied_date;
      if (input.stage !== 'saved' && !effectiveApplied) push('applied_date', todayIso());
    }

    if (sets.length > 0) {
      params.push(id, userId);
      await q.query(
        `UPDATE applications SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND user_id = $${params.length}`,
        params,
      );
    }

    if (stageChanged) {
      await logActivity(q, {
        applicationId: id,
        userId,
        type: 'stage_changed',
        message: `Moved from ${STAGE_LABELS[cur.stage as Stage]} to ${STAGE_LABELS[input.stage as Stage]}`,
        metadata: { from: cur.stage, to: input.stage },
      });
    }
    if (input.resumeId !== undefined && input.resumeId !== cur.resume_id) {
      await logActivity(q, {
        applicationId: id,
        userId,
        type: 'resume_attached',
        message: input.resumeId ? 'Attached a resume' : 'Removed the attached resume',
        metadata: { resumeId: input.resumeId },
      });
    }
    if (changedFields.length > 0) {
      await logActivity(q, {
        applicationId: id,
        userId,
        type: 'updated',
        message: `Updated ${changedFields.join(', ')}`,
        metadata: { fields: changedFields },
      });
    }
  });
}

export async function deleteApplication(db: Db, userId: string, id: string) {
  const { rowCount } = await db.query('DELETE FROM applications WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!rowCount) throw notFound('Application');
}

export async function listActivity(db: Db, userId: string, applicationId: string) {
  const owned = await db.query('SELECT 1 FROM applications WHERE id = $1 AND user_id = $2', [applicationId, userId]);
  if (!owned.rowCount) throw notFound('Application');
  const { rows } = await db.query(
    `SELECT id, type, message, metadata, created_at AS "createdAt"
       FROM application_activity WHERE application_id = $1 AND user_id = $2
      ORDER BY created_at DESC, id LIMIT 200`,
    [applicationId, userId],
  );
  return rows;
}
