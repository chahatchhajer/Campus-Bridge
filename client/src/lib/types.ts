export const STAGES = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected'] as const;
export type Stage = (typeof STAGES)[number];
export type JobType = 'internship' | 'full_time' | 'part_time' | 'contract';
export type RoleType = 'engineering' | 'data' | 'design' | 'product' | 'business' | 'other';
export type RoundType = 'phone_screen' | 'technical' | 'behavioral' | 'hr' | 'onsite' | 'other';
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled';
export type InterviewOutcome = 'pending' | 'passed' | 'failed';

export type Application = {
  id: string;
  company: string;
  sector: string;
  jobTitle: string;
  jobType: JobType;
  roleType: RoleType;
  location: string;
  source: string;
  stage: Stage;
  appliedDate: string | null;
  deadline: string | null;
  notes: string;
  resumeId: string | null;
  isDemo: boolean;
  stageUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  interviewCount?: number;
  nextInterviewAt?: string | null;
};

export type Interview = {
  id: string;
  applicationId: string;
  roundType: RoundType;
  scheduledAt: string;
  status: InterviewStatus;
  outcome: InterviewOutcome;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityItem = {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ApplicationDetail = Application & {
  resumeName: string | null;
  interviews: Interview[];
  activity: ActivityItem[];
};

export type Resume = {
  id: string;
  name: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  applicationCount: number;
};

export type Profile = {
  id: string;
  email: string | null;
  fullName: string;
  university: string;
  department: string;
  graduationYear: number | null;
  preferences: { deadlineReminders: boolean; defaultView: 'table' | 'board' };
};

export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };

export type Dashboard = {
  kpis: { activeApplications: number; upcomingInterviews: number; offers: number; deadlinesNext14Days: number; totalApplications: number };
  stageCounts: Record<Stage, number>;
  upcomingInterviews: (Pick<Interview, 'id' | 'roundType' | 'scheduledAt' | 'status' | 'outcome'> & {
    applicationId: string;
    company: string;
    jobTitle: string;
  })[];
  upcomingDeadlines: { id: string; company: string; jobTitle: string; stage: Stage; deadline: string }[];
  recentActivity: { id: string; applicationId: string; company: string; jobTitle: string; type: string; message: string; createdAt: string }[];
};

export type CalendarData = {
  interviews: Dashboard['upcomingInterviews'];
  deadlines: Dashboard['upcomingDeadlines'];
};

export type Metric = { numerator: number; denominator: number; percent: number | null };

export type AnalyticsSummary = {
  totalApplications: number;
  submitted: number;
  interviewed: number;
  offers: number;
  rejected: number;
  responded: number;
  interviewRate: Metric;
  offerRate: Metric;
  applicationToInterview: Metric;
  interviewToOffer: Metric;
  sampleData: { sampleApplications: number; totalApplications: number };
};

export type FunnelData = {
  reached: { key: string; label: string; count: number }[];
  currentStage: { key: string; label: string; count: number }[];
};

export type MonthlyPoint = { month: string; applications: number; submitted: number; interviewed: number; offers: number };

export type Breakdowns = {
  roleType: { roleType: RoleType; total: number; submitted: number; interviewed: number; offers: number; rejected: number; inProgress: number; saved: number }[];
  sector: { sector: string; total: number; submitted: number; interviewed: number; offers: number }[];
  interviewOutcomes: { passed: number; failed: number; awaiting: number; scheduled: number; cancelled: number; passRate: Metric };
  interviewRounds: { roundType: RoundType; total: number; passed: number; failed: number; passRate: Metric }[];
};

export type AnalyticsFilters = { from?: string; to?: string; jobType?: JobType | '' };
