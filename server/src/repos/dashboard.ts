import type { Db } from '../db.js';

export async function getDashboard(db: Db, userId: string) {
  const [counts, upcomingInterviews, upcomingDeadlines, recentActivity] = await Promise.all([
    db.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE stage IN ('applied','assessment','interview'))::int AS active,
              count(*) FILTER (WHERE stage = 'saved')::int AS saved,
              count(*) FILTER (WHERE stage = 'applied')::int AS applied,
              count(*) FILTER (WHERE stage = 'assessment')::int AS assessment,
              count(*) FILTER (WHERE stage = 'interview')::int AS interview,
              count(*) FILTER (WHERE stage = 'offer')::int AS offer,
              count(*) FILTER (WHERE stage = 'rejected')::int AS rejected,
              count(*) FILTER (WHERE stage <> 'rejected' AND deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 14)::int AS "deadlinesNext14"
         FROM applications WHERE user_id = $1`,
      [userId],
    ),
    db.query(
      `SELECT i.id, i.application_id AS "applicationId", a.company, a.job_title AS "jobTitle",
              i.round_type AS "roundType", i.scheduled_at AS "scheduledAt", i.status, i.outcome
         FROM interviews i JOIN applications a ON a.id = i.application_id
        WHERE i.user_id = $1 AND i.status = 'scheduled' AND i.scheduled_at >= now()
        ORDER BY i.scheduled_at LIMIT 5`,
      [userId],
    ),
    db.query(
      `SELECT id, company, job_title AS "jobTitle", stage, deadline
         FROM applications
        WHERE user_id = $1 AND stage <> 'rejected' AND deadline >= CURRENT_DATE
        ORDER BY deadline, company LIMIT 5`,
      [userId],
    ),
    db.query(
      `SELECT l.id, l.application_id AS "applicationId", a.company, a.job_title AS "jobTitle",
              l.type, l.message, l.created_at AS "createdAt"
         FROM application_activity l JOIN applications a ON a.id = l.application_id
        WHERE l.user_id = $1 ORDER BY l.created_at DESC, l.id LIMIT 8`,
      [userId],
    ),
  ]);

  const c = counts.rows[0];
  const upcomingCount = (
    await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM interviews WHERE user_id = $1 AND status = 'scheduled' AND scheduled_at >= now()`,
      [userId],
    )
  ).rows[0].n;

  return {
    kpis: {
      activeApplications: c.active,
      upcomingInterviews: upcomingCount,
      offers: c.offer,
      deadlinesNext14Days: c.deadlinesNext14,
      totalApplications: c.total,
    },
    stageCounts: {
      saved: c.saved,
      applied: c.applied,
      assessment: c.assessment,
      interview: c.interview,
      offer: c.offer,
      rejected: c.rejected,
    },
    upcomingInterviews: upcomingInterviews.rows,
    upcomingDeadlines: upcomingDeadlines.rows,
    recentActivity: recentActivity.rows,
  };
}

/** Interviews and deadlines inside an inclusive date range (dates are UTC calendar days). */
export async function getCalendar(db: Db, userId: string, from: string, to: string) {
  const [interviews, deadlines] = await Promise.all([
    db.query(
      `SELECT i.id, i.application_id AS "applicationId", a.company, a.job_title AS "jobTitle",
              i.round_type AS "roundType", i.scheduled_at AS "scheduledAt", i.status, i.outcome
         FROM interviews i JOIN applications a ON a.id = i.application_id
        WHERE i.user_id = $1 AND i.scheduled_at >= $2::date AND i.scheduled_at < ($3::date + 1)
        ORDER BY i.scheduled_at`,
      [userId, from, to],
    ),
    db.query(
      `SELECT id, company, job_title AS "jobTitle", stage, deadline
         FROM applications
        WHERE user_id = $1 AND deadline BETWEEN $2::date AND $3::date
        ORDER BY deadline, company`,
      [userId, from, to],
    ),
  ]);
  return { interviews: interviews.rows, deadlines: deadlines.rows };
}
