/**
 * GDG Edge analytics - all numbers come from PostgreSQL aggregates scoped to one student.
 *
 * Metric definitions (also shown in the UI):
 *
 *   activity date   COALESCE(applied_date, created_at::date). Saved-only applications have no
 *                   applied date, so the day they were saved is used. The date-range filter and
 *                   the monthly trend both use this single definition.
 *   total           every application in the filtered set (including "saved").
 *   submitted       applications whose stage is not "saved".
 *   interviewed     submitted applications that have at least one interview round, or whose
 *                   stage is "interview" or "offer". Rejected applications that had interviews
 *                   still count, so the funnel does not forget them.
 *   offers          applications currently at stage "offer".
 *   responded       submitted applications that produced any employer response: interviewed,
 *                   offer, or rejected. "Applied"/"assessment" with no interview are still pending.
 *
 *   interview rate              interviewed / submitted
 *   offer rate                  offers / submitted
 *   application -> interview    interviewed / responded      (conversion among applications that
 *                                                             have been answered; pending ones are
 *                                                             excluded rather than counted as losses)
 *   interview -> offer          offers / interviewed
 *
 * Every rate is returned as { numerator, denominator, percent } and percent is null when the
 * denominator is 0 (never 0%, which would claim a result that has no data behind it).
 */
import type { Queryable } from './db.js';
import type { AnalyticsFilters } from './schemas.js';

export type Metric = { numerator: number; denominator: number; percent: number | null };

export const toMetric = (numerator: number, denominator: number): Metric => ({
  numerator,
  denominator,
  percent: denominator === 0 ? null : Math.round((1000 * numerator) / denominator) / 10,
});

/**
 * Shared CTE. Parameters: $1 user id, $2 from (date|null), $3 to (date|null), $4 job type (text|null).
 * Values are always bound; nothing from the request is interpolated into SQL text.
 */
const BASE_CTE = `
  WITH base AS (
    SELECT a.id,
           a.stage,
           a.role_type,
           a.sector,
           a.job_type,
           COALESCE(a.applied_date, a.created_at::date) AS activity_date,
           (a.stage <> 'saved') AS submitted,
           (a.stage <> 'saved' AND (
              a.stage IN ('interview', 'offer')
              OR EXISTS (SELECT 1 FROM interviews i WHERE i.application_id = a.id AND i.user_id = a.user_id)
           )) AS interviewed
      FROM applications a
     WHERE a.user_id = $1
       AND ($2::date IS NULL OR COALESCE(a.applied_date, a.created_at::date) >= $2::date)
       AND ($3::date IS NULL OR COALESCE(a.applied_date, a.created_at::date) <= $3::date)
       AND ($4::text IS NULL OR a.job_type = $4::text)
  )`;

const args = (userId: string, f: AnalyticsFilters) => [userId, f.from ?? null, f.to ?? null, f.jobType ?? null];

export async function getSummary(db: Queryable, userId: string, f: AnalyticsFilters) {
  const { rows } = await db.query(
    `${BASE_CTE}
     SELECT count(*)::int                                                       AS total,
            count(*) FILTER (WHERE submitted)::int                              AS submitted,
            count(*) FILTER (WHERE interviewed)::int                            AS interviewed,
            count(*) FILTER (WHERE stage = 'offer')::int                        AS offers,
            count(*) FILTER (WHERE stage = 'rejected')::int                     AS rejected,
            count(*) FILTER (WHERE interviewed OR stage IN ('offer', 'rejected'))::int AS responded
       FROM base`,
    args(userId, f),
  );
  const r = rows[0];
  return {
    totalApplications: r.total as number,
    submitted: r.submitted as number,
    interviewed: r.interviewed as number,
    offers: r.offers as number,
    rejected: r.rejected as number,
    responded: r.responded as number,
    interviewRate: toMetric(r.interviewed, r.submitted),
    offerRate: toMetric(r.offers, r.submitted),
    applicationToInterview: toMetric(r.interviewed, r.responded),
    interviewToOffer: toMetric(r.offers, r.interviewed),
  };
}

export async function getFunnel(db: Queryable, userId: string, f: AnalyticsFilters) {
  const { rows } = await db.query(
    `${BASE_CTE}
     SELECT count(*)::int                                        AS total,
            count(*) FILTER (WHERE submitted)::int               AS submitted,
            count(*) FILTER (WHERE interviewed)::int             AS interviewed,
            count(*) FILTER (WHERE stage = 'offer')::int         AS offers,
            count(*) FILTER (WHERE stage = 'saved')::int         AS saved,
            count(*) FILTER (WHERE stage = 'applied')::int       AS applied,
            count(*) FILTER (WHERE stage = 'assessment')::int    AS assessment,
            count(*) FILTER (WHERE stage = 'interview')::int     AS interview,
            count(*) FILTER (WHERE stage = 'rejected')::int      AS rejected
       FROM base`,
    args(userId, f),
  );
  const r = rows[0];
  return {
    // Cumulative "reached" funnel: each step is a subset of the previous one.
    reached: [
      { key: 'total', label: 'Tracked', count: r.total as number },
      { key: 'submitted', label: 'Submitted', count: r.submitted as number },
      { key: 'interviewed', label: 'Interviewed', count: r.interviewed as number },
      { key: 'offers', label: 'Offer', count: r.offers as number },
    ],
    // Where applications sit right now.
    currentStage: [
      { key: 'saved', label: 'Saved', count: r.saved as number },
      { key: 'applied', label: 'Applied', count: r.applied as number },
      { key: 'assessment', label: 'Assessment', count: r.assessment as number },
      { key: 'interview', label: 'Interview', count: r.interview as number },
      { key: 'offer', label: 'Offer', count: r.offers as number },
      { key: 'rejected', label: 'Rejected', count: r.rejected as number },
    ],
  };
}

/** Monthly trend with empty months filled in; capped to the most recent 36 months. */
export async function getMonthly(db: Queryable, userId: string, f: AnalyticsFilters) {
  const { rows } = await db.query(
    `${BASE_CTE},
     bounds AS (
       SELECT GREATEST(
                date_trunc('month', COALESCE($2::date, min(activity_date)))::date,
                (date_trunc('month', COALESCE($3::date, max(activity_date))) - interval '35 months')::date
              ) AS first_month,
              date_trunc('month', COALESCE($3::date, max(activity_date)))::date AS last_month
         FROM base
     ),
     months AS (
       SELECT generate_series(first_month, last_month, interval '1 month')::date AS month
         FROM bounds WHERE first_month IS NOT NULL
     )
     SELECT to_char(m.month, 'YYYY-MM')                          AS month,
            count(b.id)::int                                      AS applications,
            count(b.id) FILTER (WHERE b.submitted)::int           AS submitted,
            count(b.id) FILTER (WHERE b.interviewed)::int         AS interviewed,
            count(b.id) FILTER (WHERE b.stage = 'offer')::int     AS offers
       FROM months m
       LEFT JOIN base b ON date_trunc('month', b.activity_date)::date = m.month
      GROUP BY m.month
      ORDER BY m.month`,
    args(userId, f),
  );
  return rows as { month: string; applications: number; submitted: number; interviewed: number; offers: number }[];
}

export async function getBreakdowns(db: Queryable, userId: string, f: AnalyticsFilters) {
  const params = args(userId, f);

  const [role, sector, outcomes, rounds] = await Promise.all([
    db.query(
      `${BASE_CTE}
       SELECT role_type AS "roleType",
              count(*)::int                                                       AS total,
              count(*) FILTER (WHERE submitted)::int                              AS submitted,
              count(*) FILTER (WHERE interviewed)::int                            AS interviewed,
              count(*) FILTER (WHERE stage = 'offer')::int                        AS offers,
              count(*) FILTER (WHERE stage = 'rejected')::int                     AS rejected,
              count(*) FILTER (WHERE stage IN ('applied','assessment','interview'))::int AS "inProgress",
              count(*) FILTER (WHERE stage = 'saved')::int                        AS saved
         FROM base GROUP BY role_type ORDER BY total DESC, role_type`,
      params,
    ),
    db.query(
      `${BASE_CTE}
       SELECT sector,
              count(*)::int                                  AS total,
              count(*) FILTER (WHERE submitted)::int         AS submitted,
              count(*) FILTER (WHERE interviewed)::int       AS interviewed,
              count(*) FILTER (WHERE stage = 'offer')::int   AS offers
         FROM base GROUP BY sector ORDER BY total DESC, sector LIMIT 10`,
      params,
    ),
    db.query(
      `${BASE_CTE}
       SELECT count(*) FILTER (WHERE i.status <> 'cancelled' AND i.outcome = 'passed')::int  AS passed,
              count(*) FILTER (WHERE i.status <> 'cancelled' AND i.outcome = 'failed')::int  AS failed,
              count(*) FILTER (WHERE i.status = 'completed' AND i.outcome = 'pending')::int  AS awaiting,
              count(*) FILTER (WHERE i.status = 'scheduled' AND i.outcome = 'pending')::int  AS scheduled,
              count(*) FILTER (WHERE i.status = 'cancelled')::int                            AS cancelled
         FROM interviews i JOIN base b ON b.id = i.application_id
        WHERE i.user_id = $1`,
      params,
    ),
    db.query(
      `${BASE_CTE}
       SELECT i.round_type AS "roundType",
              count(*)::int                                                                  AS total,
              count(*) FILTER (WHERE i.status <> 'cancelled' AND i.outcome = 'passed')::int  AS passed,
              count(*) FILTER (WHERE i.status <> 'cancelled' AND i.outcome = 'failed')::int  AS failed
         FROM interviews i JOIN base b ON b.id = i.application_id
        WHERE i.user_id = $1
        GROUP BY i.round_type ORDER BY total DESC, i.round_type`,
      params,
    ),
  ]);

  const o = outcomes.rows[0];
  return {
    roleType: role.rows,
    sector: sector.rows,
    interviewOutcomes: {
      passed: o.passed as number,
      failed: o.failed as number,
      awaiting: o.awaiting as number,
      scheduled: o.scheduled as number,
      cancelled: o.cancelled as number,
      // Pass rate only counts rounds that have a recorded result.
      passRate: toMetric(o.passed, o.passed + o.failed),
    },
    interviewRounds: (rounds.rows as { roundType: string; total: number; passed: number; failed: number }[]).map((r) => ({
      ...r,
      passRate: toMetric(r.passed, r.passed + r.failed),
    })),
  };
}

export async function getDemoCount(db: Queryable, userId: string, f: AnalyticsFilters) {
  const { rows } = await db.query<{ demo: number; total: number }>(
    `SELECT count(*) FILTER (WHERE is_demo)::int AS demo, count(*)::int AS total
       FROM applications a
      WHERE a.user_id = $1
        AND ($2::date IS NULL OR COALESCE(a.applied_date, a.created_at::date) >= $2::date)
        AND ($3::date IS NULL OR COALESCE(a.applied_date, a.created_at::date) <= $3::date)
        AND ($4::text IS NULL OR a.job_type = $4::text)`,
    args(userId, f),
  );
  return rows[0];
}
