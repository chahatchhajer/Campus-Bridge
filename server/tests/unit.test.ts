import { describe, expect, it } from 'vitest';
import { toMetric } from '../src/analytics.js';
import { loadConfig } from '../src/config.js';
import { cleanFilename, hasPdfSignature } from '../src/routes/resumes.js';
import {
  analyticsQuery,
  createApplicationSchema,
  createInterviewSchema,
  listApplicationsQuery,
  rangeQuery,
  updateApplicationSchema,
} from '../src/schemas.js';
import { escapeLike } from '../src/http.js';

describe('toMetric', () => {
  it('returns numerator, denominator and a one-decimal percent', () => {
    expect(toMetric(1, 3)).toEqual({ numerator: 1, denominator: 3, percent: 33.3 });
    expect(toMetric(2, 3).percent).toBe(66.7);
    expect(toMetric(5, 5).percent).toBe(100);
  });
  it('returns null (not 0%) when the denominator is zero', () => {
    expect(toMetric(0, 0)).toEqual({ numerator: 0, denominator: 0, percent: null });
  });
});

describe('input validation', () => {
  it('requires company and job title and trims them', () => {
    expect(createApplicationSchema.safeParse({ company: '  ', jobTitle: 'x' }).success).toBe(false);
    const ok = createApplicationSchema.parse({ company: '  Acme  ', jobTitle: ' Dev ' });
    expect(ok.company).toBe('Acme');
    expect(ok.jobTitle).toBe('Dev');
  });
  it('rejects unknown stages, bad dates and non-uuid resume ids', () => {
    const base = { company: 'A', jobTitle: 'B' };
    expect(createApplicationSchema.safeParse({ ...base, stage: 'hired' }).success).toBe(false);
    expect(createApplicationSchema.safeParse({ ...base, appliedDate: '2025-13-40' }).success).toBe(false);
    expect(createApplicationSchema.safeParse({ ...base, resumeId: 'nope' }).success).toBe(false);
  });
  it('PATCH schema applies no defaults and needs at least one field', () => {
    expect(updateApplicationSchema.safeParse({}).success).toBe(false);
    expect(updateApplicationSchema.parse({ stage: 'offer' })).toEqual({ stage: 'offer' });
  });
  it('validates interview payloads', () => {
    expect(createInterviewSchema.safeParse({ roundType: 'technical', scheduledAt: 'tomorrow' }).success).toBe(false);
    expect(createInterviewSchema.safeParse({ roundType: 'technical', scheduledAt: '2026-05-01T10:00:00Z' }).success).toBe(true);
  });
  it('caps page size and coerces numbers from the query string', () => {
    expect(listApplicationsQuery.parse({ page: '2', pageSize: '50' })).toMatchObject({ page: 2, pageSize: 50 });
    expect(listApplicationsQuery.safeParse({ pageSize: '1000' }).success).toBe(false);
    expect(listApplicationsQuery.safeParse({ sort: 'password; DROP TABLE x' }).success).toBe(false);
  });
  it('rejects inverted analytics ranges and over-long calendar ranges', () => {
    expect(analyticsQuery.safeParse({ from: '2026-05-01', to: '2026-01-01' }).success).toBe(false);
    expect(rangeQuery.safeParse({ from: '2025-01-01', to: '2026-12-31' }).success).toBe(false);
    expect(rangeQuery.safeParse({ from: '2026-01-01', to: '2026-01-31' }).success).toBe(true);
  });
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_off\\')).toBe('100\\%\\_off\\\\');
  });
});

describe('upload helpers', () => {
  it('checks the PDF magic bytes', () => {
    expect(hasPdfSignature(Buffer.from('%PDF-1.7\n...'))).toBe(true);
    expect(hasPdfSignature(Buffer.from('<html>'))).toBe(false);
    expect(hasPdfSignature(Buffer.alloc(0))).toBe(false);
  });
  it('strips paths and control characters from filenames', () => {
    expect(cleanFilename('..\\..\\evil/../cv.pdf')).toBe('cv.pdf');
    expect(cleanFilename('a\u0000b.pdf')).toBe('ab.pdf');
    expect(cleanFilename('')).toBe('resume.pdf');
  });
});

describe('config safety', () => {
  it('refuses DEMO_MODE in production unless explicitly allowed', () => {
    const prod = { NODE_ENV: 'production', CLIENT_ORIGIN: 'https://app.example.com', DEMO_MODE: 'true' };
    expect(() => loadConfig(prod)).toThrow(/DEMO_MODE/);
    expect(loadConfig({ ...prod, ALLOW_PUBLIC_DEMO: 'true' }).demoMode).toBe(true);
  });
  it('requires an explicit non-wildcard CORS origin in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/CLIENT_ORIGIN/);
    expect(() => loadConfig({ NODE_ENV: 'production', CLIENT_ORIGIN: '*' })).toThrow(/wildcard/);
    expect(loadConfig({ NODE_ENV: 'production', CLIENT_ORIGIN: 'https://a.com/, https://b.com' }).clientOrigins).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });
  it('enables database SSL for remote hosts only', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://u:p@localhost:5432/db' }).databaseSsl).toBe(false);
    expect(loadConfig({ DATABASE_URL: 'postgres://u:p@db.abc.supabase.co:5432/postgres' }).databaseSsl).toBe(true);
  });
});
