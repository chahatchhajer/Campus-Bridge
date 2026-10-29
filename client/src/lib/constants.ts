import type { InterviewOutcome, InterviewStatus, JobType, RoleType, RoundType, Stage } from './types';

export const STAGE_LABEL: Record<Stage, string> = {
  saved: 'Saved',
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

export const STAGE_HINT: Record<Stage, string> = {
  saved: 'Bookmarked, not submitted yet',
  applied: 'Submitted, waiting to hear back',
  assessment: 'Online test or take-home',
  interview: 'In interview rounds',
  offer: 'Offer received',
  rejected: 'Closed without an offer',
};

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  internship: 'Internship',
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
};

export const ROLE_TYPE_LABEL: Record<RoleType, string> = {
  engineering: 'Engineering',
  data: 'Data & AI',
  design: 'Design',
  product: 'Product',
  business: 'Business',
  other: 'Other',
};

export const ROUND_LABEL: Record<RoundType, string> = {
  phone_screen: 'Phone screen',
  technical: 'Technical',
  behavioral: 'Behavioral',
  hr: 'HR',
  onsite: 'Onsite',
  other: 'Other',
};

export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const OUTCOME_LABEL: Record<InterviewOutcome, string> = {
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Not selected',
};

export const SECTOR_SUGGESTIONS = [
  'Software', 'Data & AI', 'Finance', 'Consulting', 'Healthcare', 'Education', 'Hardware', 'Energy',
  'Retail', 'Media', 'Design', 'Logistics', 'Gaming', 'Telecom', 'Automotive', 'Aerospace', 'Manufacturing', 'Other',
];

export const SOURCE_SUGGESTIONS = ['Campus career fair', 'Company website', 'Referral', 'Job board', 'Portfolio outreach', 'Recruiter message'];

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
