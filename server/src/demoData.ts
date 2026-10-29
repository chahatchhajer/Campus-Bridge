/**
 * Fictional sample data. Every company, role and note below is invented; nothing here
 * describes real employers or real student outcomes. Rows are flagged is_demo = true.
 * Dates are generated relative to "today" so the demo always looks current.
 */
import type { Queryable } from './db.js';

type SampleInterview = {
  round: 'phone_screen' | 'technical' | 'behavioral' | 'hr' | 'onsite';
  day: number; // days relative to today (negative = past)
  hour: number; // UTC hour
  status: 'scheduled' | 'completed' | 'cancelled';
  outcome: 'pending' | 'passed' | 'failed';
};

type SampleApp = {
  company: string;
  sector: string;
  title: string;
  jobType: 'internship' | 'full_time';
  roleType: 'engineering' | 'data' | 'design' | 'product' | 'business';
  stage: 'saved' | 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected';
  appliedAgo: number | null; // days ago, null for saved
  deadline: number | null; // days relative to today
  location: string;
  source: string;
  notes: string;
  interviews?: SampleInterview[];
};

const I = (round: SampleInterview['round'], day: number, outcome: SampleInterview['outcome'], hour = 10): SampleInterview => ({
  round,
  day,
  hour,
  status: day >= 0 && outcome === 'pending' ? 'scheduled' : 'completed',
  outcome,
});

export const SAMPLE_APPS: SampleApp[] = [
  { company: 'Lumen Harbor', sector: 'Software', title: 'Software Engineering Intern', jobType: 'internship', roleType: 'engineering', stage: 'offer', appliedAgo: 205, deadline: null, location: 'Remote', source: 'Campus career fair', notes: 'Fictional sample record. Offer response due soon.', interviews: [I('phone_screen', -190, 'passed'), I('technical', -183, 'passed'), I('behavioral', -176, 'passed')] },
  { company: 'Brightloom Systems', sector: 'Software', title: 'Backend Developer Intern', jobType: 'internship', roleType: 'engineering', stage: 'rejected', appliedAgo: 198, deadline: null, location: 'Bengaluru', source: 'Company website', notes: 'Fictional sample record.', interviews: [I('phone_screen', -185, 'passed'), I('technical', -178, 'failed')] },
  { company: 'Quillstone Bank', sector: 'Finance', title: 'Technology Analyst Intern', jobType: 'internship', roleType: 'business', stage: 'rejected', appliedAgo: 190, deadline: null, location: 'Mumbai', source: 'Referral', notes: 'Fictional sample record.' },
  { company: 'Orchid Analytics', sector: 'Data & AI', title: 'Data Analyst Intern', jobType: 'internship', roleType: 'data', stage: 'offer', appliedAgo: 172, deadline: null, location: 'Hyderabad', source: 'Job board', notes: 'Fictional sample record.', interviews: [I('phone_screen', -160, 'passed'), I('technical', -152, 'passed')] },
  { company: 'Tidewater Robotics', sector: 'Hardware', title: 'Embedded Systems Intern', jobType: 'internship', roleType: 'engineering', stage: 'rejected', appliedAgo: 165, deadline: null, location: 'Pune', source: 'Campus career fair', notes: 'Fictional sample record.' },
  { company: 'Meridian Health Tech', sector: 'Healthcare', title: 'Product Intern', jobType: 'internship', roleType: 'product', stage: 'rejected', appliedAgo: 150, deadline: null, location: 'Remote', source: 'Company website', notes: 'Fictional sample record.', interviews: [I('phone_screen', -140, 'passed'), I('behavioral', -133, 'failed')] },
  { company: 'Fernhill Studio', sector: 'Design', title: 'Product Design Intern', jobType: 'internship', roleType: 'design', stage: 'rejected', appliedAgo: 140, deadline: null, location: 'Remote', source: 'Portfolio outreach', notes: 'Fictional sample record.' },
  { company: 'Alder & Pine Consulting', sector: 'Consulting', title: 'Business Analyst Intern', jobType: 'internship', roleType: 'business', stage: 'rejected', appliedAgo: 128, deadline: null, location: 'Delhi', source: 'Referral', notes: 'Fictional sample record.', interviews: [I('hr', -118, 'failed')] },
  { company: 'Copperline Logistics', sector: 'Logistics', title: 'Operations Data Intern', jobType: 'internship', roleType: 'data', stage: 'rejected', appliedAgo: 120, deadline: null, location: 'Chennai', source: 'Job board', notes: 'Fictional sample record.' },
  { company: 'Skyward Foundry', sector: 'Software', title: 'Frontend Engineer Intern', jobType: 'internship', roleType: 'engineering', stage: 'interview', appliedAgo: 62, deadline: null, location: 'Remote', source: 'Campus career fair', notes: 'Fictional sample record. Prepare system design questions.', interviews: [I('phone_screen', -40, 'passed'), I('technical', 3, 'pending', 11)] },
  { company: 'Juniper Grid Energy', sector: 'Energy', title: 'Data Engineering Intern', jobType: 'internship', roleType: 'data', stage: 'rejected', appliedAgo: 110, deadline: null, location: 'Ahmedabad', source: 'Job board', notes: 'Fictional sample record.' },
  { company: 'Ashgrove Retail Group', sector: 'Retail', title: 'Analytics Intern', jobType: 'internship', roleType: 'data', stage: 'rejected', appliedAgo: 100, deadline: null, location: 'Remote', source: 'Company website', notes: 'Fictional sample record.' },
  { company: 'Halcyon Games', sector: 'Gaming', title: 'Gameplay Programmer Intern', jobType: 'internship', roleType: 'engineering', stage: 'rejected', appliedAgo: 96, deadline: null, location: 'Remote', source: 'Portfolio outreach', notes: 'Fictional sample record.', interviews: [I('technical', -85, 'failed')] },
  { company: 'Vantor Cloud', sector: 'Software', title: 'Cloud Engineer Intern', jobType: 'internship', roleType: 'engineering', stage: 'assessment', appliedAgo: 21, deadline: 6, location: 'Bengaluru', source: 'Job board', notes: 'Fictional sample record. Online assessment due this week.' },
  { company: 'Marlow Capital', sector: 'Finance', title: 'Quantitative Research Intern', jobType: 'internship', roleType: 'data', stage: 'rejected', appliedAgo: 88, deadline: null, location: 'Mumbai', source: 'Referral', notes: 'Fictional sample record.' },
  { company: 'Pebble Education', sector: 'Education', title: 'Associate Product Manager Intern', jobType: 'internship', roleType: 'product', stage: 'interview', appliedAgo: 48, deadline: null, location: 'Remote', source: 'Company website', notes: 'Fictional sample record.', interviews: [I('phone_screen', -30, 'passed'), I('behavioral', 6, 'pending', 14)] },
  { company: 'Nimbus Ledger', sector: 'Finance', title: 'Software Engineer, New Grad', jobType: 'full_time', roleType: 'engineering', stage: 'applied', appliedAgo: 14, deadline: null, location: 'Bengaluru', source: 'Job board', notes: 'Fictional sample record.' },
  { company: 'Redwood Mobility', sector: 'Automotive', title: 'Software Engineer, New Grad', jobType: 'full_time', roleType: 'engineering', stage: 'applied', appliedAgo: 11, deadline: null, location: 'Pune', source: 'Campus career fair', notes: 'Fictional sample record.' },
  { company: 'Sable Biotech', sector: 'Healthcare', title: 'Bioinformatics Analyst', jobType: 'full_time', roleType: 'data', stage: 'rejected', appliedAgo: 56, deadline: null, location: 'Hyderabad', source: 'Company website', notes: 'Fictional sample record.' },
  { company: 'Kestrel Aerospace Labs', sector: 'Aerospace', title: 'Flight Software Engineer', jobType: 'full_time', roleType: 'engineering', stage: 'interview', appliedAgo: 35, deadline: null, location: 'Bengaluru', source: 'Referral', notes: 'Fictional sample record.', interviews: [I('phone_screen', -22, 'passed'), I('technical', -9, 'passed'), I('onsite', 9, 'pending', 9)] },
  { company: 'Harbor & Vine Media', sector: 'Media', title: 'UX Designer', jobType: 'full_time', roleType: 'design', stage: 'rejected', appliedAgo: 70, deadline: null, location: 'Remote', source: 'Portfolio outreach', notes: 'Fictional sample record.', interviews: [I('phone_screen', -60, 'passed'), I('hr', -52, 'failed')] },
  { company: 'Crestline Payments', sector: 'Finance', title: 'Product Analyst', jobType: 'full_time', roleType: 'product', stage: 'applied', appliedAgo: 6, deadline: null, location: 'Mumbai', source: 'Job board', notes: 'Fictional sample record.' },
  { company: 'Windmere Telecom', sector: 'Telecom', title: 'Network Software Intern', jobType: 'internship', roleType: 'engineering', stage: 'rejected', appliedAgo: 44, deadline: null, location: 'Noida', source: 'Campus career fair', notes: 'Fictional sample record.' },
  { company: 'Opaline Design Co.', sector: 'Design', title: 'Visual Design Intern', jobType: 'internship', roleType: 'design', stage: 'applied', appliedAgo: 9, deadline: null, location: 'Remote', source: 'Portfolio outreach', notes: 'Fictional sample record.' },
  { company: 'Summit Row Advisory', sector: 'Consulting', title: 'Strategy Analyst', jobType: 'full_time', roleType: 'business', stage: 'saved', appliedAgo: null, deadline: 12, location: 'Delhi', source: 'Referral', notes: 'Fictional sample record. Tailor the resume before applying.' },
  { company: 'Thistle Quantum', sector: 'Data & AI', title: 'Machine Learning Engineer Intern', jobType: 'internship', roleType: 'data', stage: 'saved', appliedAgo: null, deadline: 20, location: 'Remote', source: 'Job board', notes: 'Fictional sample record.' },
  { company: 'Garnet Cloudworks', sector: 'Software', title: 'Platform Engineer Intern', jobType: 'internship', roleType: 'engineering', stage: 'saved', appliedAgo: null, deadline: 4, location: 'Remote', source: 'Company website', notes: 'Fictional sample record. Deadline is close.' },
  { company: 'Lantern Learning', sector: 'Education', title: 'Curriculum Data Analyst', jobType: 'full_time', roleType: 'data', stage: 'applied', appliedAgo: 3, deadline: null, location: 'Remote', source: 'Job board', notes: 'Fictional sample record.' },
  { company: 'Ironbark Manufacturing', sector: 'Manufacturing', title: 'Automation Engineer Intern', jobType: 'internship', roleType: 'engineering', stage: 'assessment', appliedAgo: 17, deadline: 9, location: 'Coimbatore', source: 'Campus career fair', notes: 'Fictional sample record.' },
];

const MS_DAY = 86_400_000;

function dayOffsetIso(offsetDays: number, today: Date) {
  return new Date(today.getTime() + offsetDays * MS_DAY).toISOString().slice(0, 10);
}

/** Inserts the fictional dataset for one user inside the caller's transaction. */
export async function insertSampleData(q: Queryable, userId: string, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let count = 0;

  for (const app of SAMPLE_APPS) {
    const applied = app.appliedAgo === null ? null : dayOffsetIso(-app.appliedAgo, today);
    const deadline = app.deadline === null ? null : dayOffsetIso(app.deadline, today);
    const createdAt = new Date(today.getTime() - (app.appliedAgo ?? 2) * MS_DAY + 9 * 3_600_000).toISOString();

    const { rows } = await q.query<{ id: string }>(
      `INSERT INTO applications
         (user_id, company, sector, job_title, job_type, role_type, location, source, stage,
          applied_date, deadline, notes, is_demo, created_at, updated_at, stage_updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$13,$13)
       RETURNING id`,
      [userId, app.company, app.sector, app.title, app.jobType, app.roleType, app.location, app.source, app.stage, applied, deadline, app.notes, createdAt],
    );
    const id = rows[0].id;
    await q.query(
      `INSERT INTO application_activity (application_id, user_id, type, message, metadata, created_at)
       VALUES ($1,$2,'created',$3,$4::jsonb,$5)`,
      [id, userId, `Added ${app.company} - ${app.title} (sample data)`, JSON.stringify({ sample: true }), createdAt],
    );

    for (const iv of app.interviews ?? []) {
      const at = new Date(today.getTime() + iv.day * MS_DAY + iv.hour * 3_600_000).toISOString();
      await q.query(
        `INSERT INTO interviews (application_id, user_id, round_type, scheduled_at, status, outcome, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'Fictional sample interview.',$7,$7)`,
        [id, userId, iv.round, at, iv.status, iv.outcome, createdAt],
      );
      const activityAt = iv.day < 0 ? at : new Date(Math.min(now.getTime(), new Date(at).getTime() - 3 * MS_DAY)).toISOString();
      await q.query(
        `INSERT INTO application_activity (application_id, user_id, type, message, metadata, created_at)
         VALUES ($1,$2,'interview_added',$3,$4::jsonb,$5)`,
        [id, userId, `Scheduled ${iv.round.replace('_', ' ')} round (sample data)`, JSON.stringify({ sample: true }), activityAt],
      );
    }
    count += 1;
  }
  return count;
}
