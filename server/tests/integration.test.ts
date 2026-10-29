/**
 * Integration tests against a real PostgreSQL (embedded, throwaway). They exercise the SQL
 * aggregation logic and the API's authentication / ownership / upload rules end to end.
 */
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getBreakdowns, getFunnel, getMonthly, getSummary } from '../src/analytics.js';
import { createApp } from '../src/app.js';
import { createTokenVerifier } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';
import { createApplication } from '../src/repos/applications.js';
import { createInterview } from '../src/repos/interviews.js';
import { LocalStorage } from '../src/storage.js';

const PORT = 54331;
const SECRET = 'test-secret-test-secret-test-secret-123456';
let pg: EmbeddedPostgres;
let db: Db;
let dir: string;
let uploads: string;
let app: ReturnType<typeof createApp>;

const userA = randomUUID();
const userB = randomUUID();
const token = (sub: string, opts: { secret?: string; aud?: string; exp?: string } = {}) =>
  new SignJWT({ email: `${sub.slice(0, 4)}@example.test` })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setAudience(opts.aud ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));
const auth = async (sub: string) => ({ Authorization: `Bearer ${await token(sub)}` });

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'cb-pg-'));
  uploads = mkdtempSync(path.join(os.tmpdir(), 'cb-up-'));
  pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: PORT, persistent: true });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('test');
  db = createDb({ databaseUrl: `postgres://postgres:postgres@localhost:${PORT}/test`, databaseSsl: false });
  await runMigrations(db);
  for (const id of [userA, userB]) await db.query('INSERT INTO profiles (id) VALUES ($1)', [id]);

  const config = loadConfig({ NODE_ENV: 'test', SUPABASE_JWT_SECRET: SECRET, CLIENT_ORIGIN: 'http://localhost:5173' });
  app = createApp(
    { config, db, storage: new LocalStorage(uploads, 'sig-secret') },
    { verifier: createTokenVerifier(config), logErrors: false, rateLimit: false },
  );

  // Deterministic dataset for user A (all dates fixed so assertions are exact):
  //   Acme   Jan  applied   (rejected, no interview)
  //   Beta   Jan  interview (2 rounds: passed + pending)       -> interviewed
  //   Gamma  Feb  offer     (1 round passed)                    -> interviewed, offer
  //   Delta  Feb  applied   (still pending)
  //   Eps    Mar  rejected  (1 round failed)                    -> interviewed
  //   Zeta   Mar  saved     (no applied date; created_at March) -> not submitted
  //   Eta    Jan  applied   job_type full_time, role data
  const mk = (company: string, extra: Record<string, unknown>) =>
    createApplication(db, userA, { company, jobTitle: 'Role', sector: 'Tech', ...extra } as never);
  const acme = await mk('Acme', { stage: 'rejected', appliedDate: '2026-01-10' });
  const beta = await mk('Beta', { stage: 'applied', appliedDate: '2026-01-20' });
  const gamma = await mk('Gamma', { stage: 'applied', appliedDate: '2026-02-03', roleType: 'data', sector: 'Finance' });
  await mk('Delta', { stage: 'applied', appliedDate: '2026-02-15' });
  const eps = await mk('Eps', { stage: 'applied', appliedDate: '2026-03-02', sector: 'Finance' });
  const zeta = await mk('Zeta', { stage: 'saved' });
  await mk('Eta', { stage: 'applied', appliedDate: '2026-01-25', jobType: 'full_time', roleType: 'data' });
  await db.query(`UPDATE applications SET created_at = '2026-03-20' WHERE id = $1`, [zeta]);
  void acme;

  await createInterview(db, userA, beta, { roundType: 'phone_screen', scheduledAt: '2026-02-01T10:00:00Z', status: 'completed', outcome: 'passed' });
  await createInterview(db, userA, beta, { roundType: 'technical', scheduledAt: '2099-01-01T10:00:00Z' });
  await createInterview(db, userA, gamma, { roundType: 'technical', scheduledAt: '2026-02-20T10:00:00Z', status: 'completed', outcome: 'passed' });
  await db.query(`UPDATE applications SET stage = 'offer' WHERE id = $1`, [gamma]);
  await createInterview(db, userA, eps, { roundType: 'hr', scheduledAt: '2026-03-10T10:00:00Z', status: 'completed', outcome: 'failed' });
  await db.query(`UPDATE applications SET stage = 'rejected' WHERE id = $1`, [eps]);
  await db.query(`UPDATE applications SET stage = 'rejected' WHERE company = 'Acme' AND user_id = $1`, [userA]);

  // User B has one application that must never leak into A's numbers.
  await createApplication(db, userB, { company: 'B-only', jobTitle: 'Secret', stage: 'offer', appliedDate: '2026-01-05' });
}, 180_000);

afterAll(async () => {
  await db?.close();
  await pg?.stop();
  // Windows can briefly keep the data directory locked after Postgres exits; cleanup is best effort.
  for (const d of [dir, uploads]) {
    try {
      rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      /* temp dir is removed by the OS eventually */
    }
  }
});

describe('analytics SQL aggregation', () => {
  it('computes counts and rates with explicit numerators and denominators', async () => {
    const s = await getSummary(db, userA, {});
    expect(s.totalApplications).toBe(7);
    expect(s.submitted).toBe(6); // all but the saved one
    expect(s.interviewed).toBe(3); // Beta, Gamma, Eps
    expect(s.offers).toBe(1);
    expect(s.rejected).toBe(2); // Acme, Eps
    expect(s.responded).toBe(4); // 3 interviewed + Acme rejected (Gamma/Eps already counted)
    expect(s.interviewRate).toEqual({ numerator: 3, denominator: 6, percent: 50 });
    expect(s.offerRate).toEqual({ numerator: 1, denominator: 6, percent: 16.7 });
    expect(s.applicationToInterview).toEqual({ numerator: 3, denominator: 4, percent: 75 });
    expect(s.interviewToOffer).toEqual({ numerator: 1, denominator: 3, percent: 33.3 });
  });

  it('isolates each student (user B never appears in user A numbers)', async () => {
    const b = await getSummary(db, userB, {});
    expect(b.totalApplications).toBe(1);
    expect(b.offers).toBe(1);
    expect((await getSummary(db, randomUUID(), {})).interviewRate).toEqual({ numerator: 0, denominator: 0, percent: null });
  });

  it('applies date-range and job-type filters with bound parameters', async () => {
    const jan = await getSummary(db, userA, { from: '2026-01-01', to: '2026-01-31' });
    expect(jan.totalApplications).toBe(3); // Acme, Beta, Eta
    const ft = await getSummary(db, userA, { jobType: 'full_time' });
    expect(ft.totalApplications).toBe(1);
    // Hostile input is only ever a bound value, never SQL text:
    await expect(getSummary(db, userA, { jobType: "internship'; DROP TABLE applications;--" as never })).resolves.toMatchObject({ totalApplications: 0 });
    expect((await db.query('SELECT count(*)::int AS n FROM applications')).rows[0].n).toBeGreaterThan(0);
  });

  it('builds a cumulative funnel where each step is a subset of the previous', async () => {
    const f = await getFunnel(db, userA, {});
    expect(f.reached.map((r) => r.count)).toEqual([7, 6, 3, 1]);
    expect(f.currentStage.find((s) => s.key === 'rejected')?.count).toBe(2);
    expect(f.currentStage.reduce((n, s) => n + s.count, 0)).toBe(7);
  });

  it('returns a gap-filled monthly trend using DATE_TRUNC', async () => {
    const m = await getMonthly(db, userA, {});
    expect(m.map((r) => r.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(m.map((r) => r.applications)).toEqual([3, 2, 2]); // Zeta counted in March via created_at
    expect(m.map((r) => r.interviewed)).toEqual([1, 1, 1]);
    expect(m.map((r) => r.offers)).toEqual([0, 1, 0]);

    // A range with no data in between still yields continuous months.
    await db.query(`UPDATE applications SET applied_date = '2025-11-10' WHERE company = 'Acme' AND user_id = $1`, [userA]);
    const gap = await getMonthly(db, userA, {});
    expect(gap.map((r) => r.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
    expect(gap[1].applications).toBe(0);
    await db.query(`UPDATE applications SET applied_date = '2026-01-10' WHERE company = 'Acme' AND user_id = $1`, [userA]);
  });

  it('groups by role type, sector and interview outcome', async () => {
    const b = await getBreakdowns(db, userA, {});
    const data = b.roleType.find((r) => r.roleType === 'data');
    expect(data).toMatchObject({ total: 2, offers: 1 });
    expect(b.sector.find((s) => s.sector === 'Finance')).toMatchObject({ total: 2, interviewed: 2, offers: 1 });
    expect(b.interviewOutcomes).toMatchObject({ passed: 2, failed: 1, scheduled: 1, awaiting: 0, cancelled: 0 });
    expect(b.interviewOutcomes.passRate).toEqual({ numerator: 2, denominator: 3, percent: 66.7 });
    expect(b.interviewRounds.find((r) => r.roundType === 'technical')?.total).toBe(2);
  });
});

describe('API authentication', () => {
  it('rejects requests without a token, with a bad signature, wrong audience or expired token', async () => {
    await request(app).get('/api/applications').expect(401);
    const forged = await token(userA, { secret: 'a-completely-different-secret-value-xxxxxxxx' });
    await request(app).get('/api/applications').set('Authorization', `Bearer ${forged}`).expect(401);
    await request(app).get('/api/applications').set('Authorization', `Bearer ${await token(userA, { aud: 'anon' })}`).expect(401);
    await request(app).get('/api/applications').set('Authorization', `Bearer ${await token(userA, { exp: '-1m' })}`).expect(401);
    await request(app).get('/api/applications').set('Authorization', 'Bearer not-a-jwt').expect(401);
  });

  it('ignores client-supplied identity: user id headers/query/body never change ownership', async () => {
    const res = await request(app)
      .get('/api/applications')
      .query({ userId: userA, user_id: userA })
      .set({ ...(await auth(userB)), 'x-user-id': userA, 'x-role': 'admin' })
      .expect(200);
    expect(res.body.data.map((a: { company: string }) => a.company)).toEqual(['B-only']);
  });

  it('provisions a profile on first authenticated request', async () => {
    const fresh = randomUUID();
    const res = await request(app).get('/api/profile').set(await auth(fresh)).expect(200);
    expect(res.body.data.id).toBe(fresh);
  });
});

describe('applications API', () => {
  it('lists with pagination, search and filters', async () => {
    const h = await auth(userA);
    const page = await request(app).get('/api/applications').query({ pageSize: 3, page: 2, sort: 'company', order: 'asc' }).set(h).expect(200);
    expect(page.body.meta).toMatchObject({ page: 2, pageSize: 3, total: 7, totalPages: 3 });
    expect(page.body.data).toHaveLength(3);

    const search = await request(app).get('/api/applications').query({ search: 'gam' }).set(h).expect(200);
    expect(search.body.data.map((a: { company: string }) => a.company)).toEqual(['Gamma']);
    const pct = await request(app).get('/api/applications').query({ search: '%' }).set(h).expect(200);
    expect(pct.body.data).toHaveLength(0); // wildcard is matched literally

    const stage = await request(app).get('/api/applications').query({ stage: 'offer' }).set(h).expect(200);
    expect(stage.body.meta.total).toBe(1);
    await request(app).get('/api/applications').query({ stage: 'bogus' }).set(h).expect(400);
  });

  it('validates input and reports field-level errors', async () => {
    const res = await request(app).post('/api/applications').set(await auth(userA)).send({ company: '', jobTitle: 'x' }).expect(400);
    expect(res.body.error.code).toBe('validation_failed');
    expect(res.body.error.details[0].path).toBe('company');
    await request(app).post('/api/applications').set(await auth(userA)).send('{bad json').set('Content-Type', 'application/json').expect(400);
    await request(app).get('/api/applications/not-a-uuid').set(await auth(userA)).expect(400);
  });

  it('supports create, stage move with activity log, edit and delete', async () => {
    const h = await auth(userA);
    const created = await request(app).post('/api/applications').set(h).send({ company: 'Flow Co', jobTitle: 'Intern', stage: 'saved' }).expect(201);
    const id = created.body.data.id;
    expect(created.body.data.activity[0].type).toBe('created');

    const moved = await request(app).patch(`/api/applications/${id}`).set(h).send({ stage: 'applied' }).expect(200);
    expect(moved.body.data.stage).toBe('applied');
    expect(moved.body.data.appliedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // filled when leaving "saved"
    expect(moved.body.data.activity.some((a: { type: string }) => a.type === 'stage_changed')).toBe(true);

    const iv = await request(app).post(`/api/applications/${id}/interviews`).set(h).send({ roundType: 'technical', scheduledAt: '2099-05-01T09:00:00Z' }).expect(201);
    expect(iv.body.data.stageAdvanced).toBe(true);
    const detail = await request(app).get(`/api/applications/${id}`).set(h).expect(200);
    expect(detail.body.data.stage).toBe('interview');
    expect(detail.body.data.interviews).toHaveLength(1);

    await request(app).patch(`/api/interviews/${iv.body.data.id}`).set(h).send({ status: 'completed', outcome: 'passed' }).expect(200);
    await request(app).delete(`/api/interviews/${iv.body.data.id}`).set(h).expect(204);
    await request(app).delete(`/api/applications/${id}`).set(h).expect(204);
    await request(app).get(`/api/applications/${id}`).set(h).expect(404);
  });

  it("never lets one student read or change another student's records", async () => {
    const a = await auth(userA);
    const b = await auth(userB);
    const own = await request(app).post('/api/applications').set(a).send({ company: 'Private Inc', jobTitle: 'Dev' }).expect(201);
    const id = own.body.data.id;
    await request(app).get(`/api/applications/${id}`).set(b).expect(404);
    await request(app).patch(`/api/applications/${id}`).set(b).send({ company: 'Hacked' }).expect(404);
    await request(app).delete(`/api/applications/${id}`).set(b).expect(404);
    await request(app).post(`/api/applications/${id}/interviews`).set(b).send({ roundType: 'hr', scheduledAt: '2099-01-01T00:00:00Z' }).expect(404);
    await request(app).get(`/api/applications/${id}/activity`).set(b).expect(404);
    const stillThere = await request(app).get(`/api/applications/${id}`).set(a).expect(200);
    expect(stillThere.body.data.company).toBe('Private Inc');
  });
});

describe('analytics API', () => {
  it('serves summary, funnel, monthly and breakdowns, and validates filters', async () => {
    const h = await auth(userA);
    const s = await request(app).get('/api/analytics/summary').set(h).expect(200);
    expect(s.body.data.interviewRate.denominator).toBeGreaterThan(0);
    await request(app).get('/api/analytics/funnel').set(h).expect(200);
    await request(app).get('/api/analytics/monthly').query({ jobType: 'full_time' }).set(h).expect(200);
    await request(app).get('/api/analytics/breakdowns').set(h).expect(200);
    await request(app).get('/api/analytics/summary').query({ from: '2026-05-01', to: '2026-01-01' }).set(h).expect(400);
    await request(app).get('/api/analytics/summary').set({}).expect(401);
  });
});

describe('resume upload and private storage', () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

  it('rejects non-PDF content, spoofed MIME types and oversize files', async () => {
    const h = await auth(userA);
    await request(app).post('/api/resumes').set(h).expect(400); // no file
    await request(app).post('/api/resumes').set(h).attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' }).expect(415);
    await request(app).post('/api/resumes').set(h).attach('file', Buffer.from('<html>not a pdf</html>'), { filename: 'a.pdf', contentType: 'application/pdf' }).expect(415);
    const big = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(5 * 1024 * 1024 + 10)]);
    await request(app).post('/api/resumes').set(h).attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' }).expect(413);
    await request(app).post('/api/resumes').attach('file', pdf, { filename: 'a.pdf', contentType: 'application/pdf' }).expect(401);
  });

  it('uploads, lists, renames, signs a download only for the owner, and deletes with cleanup', async () => {
    const a = await auth(userA);
    const b = await auth(userB);
    const up = await request(app)
      .post('/api/resumes')
      .set(a)
      .field('name', 'My CV')
      // A hostile client filename must not influence the storage path.
      .attach('file', pdf, { filename: '../../../etc/passwd.pdf', contentType: 'application/pdf' })
      .expect(201);
    const r = up.body.data;
    expect(r.name).toBe('My CV');
    expect(r.originalFilename).toBe('passwd.pdf');
    const row = (await db.query('SELECT storage_path FROM resumes WHERE id = $1', [r.id])).rows[0];
    expect(row.storage_path).toBe(`${userA}/${r.id}.pdf`);

    expect((await request(app).get('/api/resumes').set(a).expect(200)).body.data.map((x: { id: string }) => x.id)).toContain(r.id);
    expect((await request(app).get('/api/resumes').set(b).expect(200)).body.data).toHaveLength(0);

    await request(app).patch(`/api/resumes/${r.id}`).set(a).send({ name: 'Renamed' }).expect(200);
    await request(app).patch(`/api/resumes/${r.id}`).set(b).send({ name: 'Nope' }).expect(404);
    await request(app).get(`/api/resumes/${r.id}/download`).set(b).expect(404);

    const dl = await request(app).get(`/api/resumes/${r.id}/download`).set(a).expect(200);
    expect(dl.body.data.expiresIn).toBeLessThanOrEqual(60);
    const file = await request(app).get(dl.body.data.url).expect(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    // Tampered signature / path is refused.
    await request(app).get(dl.body.data.url.replace(/sig=[0-9a-f]+/, 'sig=00')).expect(403);
    await request(app).get(dl.body.data.url.replace(`${userA}`, `${userB}`)).expect(403);

    // Attach to an application; another user's resume id is rejected.
    const created = await request(app).post('/api/applications').set(a).send({ company: 'With CV', jobTitle: 'Dev', resumeId: r.id }).expect(201);
    expect(created.body.data.resumeName).toBe('Renamed');
    await request(app).post('/api/applications').set(b).send({ company: 'Steal', jobTitle: 'Dev', resumeId: r.id }).expect(400);

    await request(app).delete(`/api/resumes/${r.id}`).set(b).expect(404);
    const del = await request(app).delete(`/api/resumes/${r.id}`).set(a).expect(200);
    expect(del.body.data.storageCleanup).toBe('ok');
    await request(app).get(dl.body.data.url).expect(404); // object removed
    const after = await request(app).get(`/api/applications/${created.body.data.id}`).set(a).expect(200);
    expect(after.body.data.resumeId).toBeNull();
  });
});

describe('account and operations endpoints', () => {
  it('health is public and leaks nothing; diagnostics are disabled without a token', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(Object.keys(res.body).sort()).toEqual(['service', 'status', 'time']);
    await request(app).get('/api/health/ready').expect(404);
  });

  it('diagnostics require the health token and return only safe fields', async () => {
    const config = loadConfig({ NODE_ENV: 'test', HEALTH_CHECK_TOKEN: 'diag-token-123', CLIENT_ORIGIN: 'http://localhost:5173' });
    const diag = createApp({ config, db, storage: new LocalStorage(uploads) }, { verifier: null, logErrors: false, rateLimit: false });
    await request(diag).get('/api/health/ready').expect(401);
    const ok = await request(diag).get('/api/health/ready').set('x-health-token', 'diag-token-123').expect(200);
    expect(ok.body.database.ok).toBe(true);
    expect(JSON.stringify(ok.body)).not.toMatch(/postgres:\/\/|password|eyJ|service_role|diag-token-123/i);
  });

  it('loads and clears fictional sample data, flagged is_demo', async () => {
    const id = randomUUID();
    await db.query('INSERT INTO profiles (id) VALUES ($1)', [id]);
    const h = await auth(id);
    const loaded = await request(app).post('/api/sample-data').set(h).expect(201);
    expect(loaded.body.data.inserted).toBeGreaterThan(20);
    await request(app).post('/api/sample-data').set(h).expect(409);
    const s = await request(app).get('/api/analytics/summary').set(h).expect(200);
    expect(s.body.data.sampleData.sampleApplications).toBe(s.body.data.totalApplications);
    const removed = await request(app).delete('/api/sample-data').set(h).expect(200);
    expect(removed.body.data.removed).toBeGreaterThan(20);
  });

  it('exports and wipes only the caller\'s data', async () => {
    const id = randomUUID();
    await db.query('INSERT INTO profiles (id) VALUES ($1)', [id]);
    const h = await auth(id);
    await request(app).post('/api/applications').set(h).send({ company: 'Mine', jobTitle: 'x' }).expect(201);
    const exp = await request(app).get('/api/profile/export').set(h).expect(200);
    expect(exp.body.applications).toHaveLength(1);
    await request(app).delete('/api/profile/data').set(h).expect(200);
    expect((await request(app).get('/api/applications').set(h)).body.meta.total).toBe(0);
    // User A's data is untouched.
    expect((await request(app).get('/api/applications').set(await auth(userA))).body.meta.total).toBeGreaterThan(5);
  });

  it('updates the profile with validation', async () => {
    const h = await auth(userA);
    const res = await request(app).patch('/api/profile').set(h).send({ fullName: 'Asha Rao', department: 'CSE', graduationYear: 2027 }).expect(200);
    expect(res.body.data).toMatchObject({ fullName: 'Asha Rao', graduationYear: 2027 });
    await request(app).patch('/api/profile').set(h).send({ graduationYear: 1800 }).expect(400);
    await request(app).patch('/api/profile').set(h).send({}).expect(400);
  });

  it('serves the dashboard and calendar', async () => {
    const h = await auth(userA);
    const d = await request(app).get('/api/dashboard').set(h).expect(200);
    expect(d.body.data.kpis.upcomingInterviews).toBeGreaterThanOrEqual(1);
    const c = await request(app).get('/api/calendar').query({ from: '2026-01-01', to: '2026-03-31' }).set(h).expect(200);
    expect(c.body.data.interviews.length).toBeGreaterThanOrEqual(3);
    await request(app).get('/api/calendar').query({ from: '2026-01-01' }).set(h).expect(400);
  });

  it('only allows the configured CORS origin', async () => {
    const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('demo mode uses a fixed server-side identity and cannot be steered by headers', async () => {
    const config = loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true', CLIENT_ORIGIN: 'http://localhost:5173' });
    const demo = createApp({ config, db, storage: null }, { verifier: null, logErrors: false, rateLimit: false });
    const res = await request(demo).get('/api/profile').set('x-user-id', userA).expect(200);
    expect(res.body.data.id).toBe('00000000-0000-4000-8000-00000000d3a0');
    await request(demo).delete('/api/profile').expect(403);
    await request(demo).post('/api/resumes').attach('file', Buffer.from('%PDF-1'), { filename: 'a.pdf', contentType: 'application/pdf' }).expect(503);
  });
});
