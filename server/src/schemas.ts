import { z } from 'zod';

export const STAGES = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected'] as const;
export const JOB_TYPES = ['internship', 'full_time', 'part_time', 'contract'] as const;
export const ROLE_TYPES = ['engineering', 'data', 'design', 'product', 'business', 'other'] as const;
export const ROUND_TYPES = ['phone_screen', 'technical', 'behavioral', 'hr', 'onsite', 'other'] as const;
export const INTERVIEW_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;
export const INTERVIEW_OUTCOMES = ['pending', 'passed', 'failed'] as const;

export type Stage = (typeof STAGES)[number];

const text = (max: number) => z.string().trim().max(max);
const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`);
const isoDate = z.iso.date('Use a valid date (YYYY-MM-DD)');
const nullableDate = isoDate.nullable();

export const uuidParam = z.object({ id: z.uuid('Invalid id') });

/** Fields shared by create and update. No defaults here, so PATCH never overwrites unsent fields. */
const applicationFields = {
  company: requiredText(120, 'Company'),
  jobTitle: requiredText(160, 'Job title'),
  jobType: z.enum(JOB_TYPES),
  roleType: z.enum(ROLE_TYPES),
  sector: requiredText(60, 'Sector'),
  location: text(120),
  source: text(80),
  stage: z.enum(STAGES),
  appliedDate: nullableDate,
  deadline: nullableDate,
  notes: text(5000),
  resumeId: z.uuid().nullable(),
};

export const createApplicationSchema = z.object({
  company: applicationFields.company,
  jobTitle: applicationFields.jobTitle,
  jobType: applicationFields.jobType.optional(),
  roleType: applicationFields.roleType.optional(),
  sector: applicationFields.sector.optional(),
  location: applicationFields.location.optional(),
  source: applicationFields.source.optional(),
  stage: applicationFields.stage.optional(),
  appliedDate: applicationFields.appliedDate.optional(),
  deadline: applicationFields.deadline.optional(),
  notes: applicationFields.notes.optional(),
  resumeId: applicationFields.resumeId.optional(),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const updateApplicationSchema = z
  .object(applicationFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

export const SORT_COLUMNS = {
  company: 'a.company',
  jobTitle: 'a.job_title',
  stage: 'a.stage',
  appliedDate: 'a.applied_date',
  deadline: 'a.deadline',
  createdAt: 'a.created_at',
  updatedAt: 'a.updated_at',
} as const;

export const listApplicationsQuery = z.object({
  search: z.string().trim().max(100).optional(),
  stage: z.enum(STAGES).optional(),
  jobType: z.enum(JOB_TYPES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sort: z.enum(Object.keys(SORT_COLUMNS) as [keyof typeof SORT_COLUMNS, ...(keyof typeof SORT_COLUMNS)[]]).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuery>;

const interviewFields = {
  roundType: z.enum(ROUND_TYPES),
  scheduledAt: z.iso.datetime({ offset: true, message: 'Use a valid date and time' }),
  status: z.enum(INTERVIEW_STATUSES),
  outcome: z.enum(INTERVIEW_OUTCOMES),
  notes: text(3000),
};

export const createInterviewSchema = z.object({
  roundType: interviewFields.roundType,
  scheduledAt: interviewFields.scheduledAt,
  status: interviewFields.status.optional(),
  outcome: interviewFields.outcome.optional(),
  notes: interviewFields.notes.optional(),
});
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;

export const updateInterviewSchema = z
  .object(interviewFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;

export const rangeQuery = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, { message: '"from" must not be after "to"', path: ['from'] })
  .refine((v) => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 400, {
    message: 'Range is limited to 400 days',
    path: ['to'],
  });

export const analyticsQuery = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    jobType: z.enum(JOB_TYPES).optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: '"from" must not be after "to"', path: ['from'] });
export type AnalyticsFilters = z.infer<typeof analyticsQuery>;

export const updateProfileSchema = z
  .object({
    fullName: text(120),
    university: text(120),
    department: text(120),
    graduationYear: z.number().int().min(2000).max(2100).nullable(),
    preferences: z.object({
      deadlineReminders: z.boolean(),
      defaultView: z.enum(['table', 'board']),
    }),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const renameResumeSchema = z.object({ name: requiredText(120, 'Name') });
export const downloadQuery = z.object({ disposition: z.enum(['inline', 'attachment']).default('inline') });
