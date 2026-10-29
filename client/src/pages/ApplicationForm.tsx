import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { Button } from '../components/ui/Button';
import { Card, PageHeader, usePageTitle } from '../components/ui/Bits';
import { ErrorState, SkeletonCard } from '../components/ui/Feedback';
import { SelectField, TextField, TextareaField } from '../components/ui/Form';
import { useToast } from '../components/ui/Toast';
import { ApiError, errorMessage, fieldErrors } from '../lib/api';
import { JOB_TYPE_LABEL, ROLE_TYPE_LABEL, SECTOR_SUGGESTIONS, SOURCE_SUGGESTIONS, STAGE_HINT, STAGE_LABEL } from '../lib/constants';
import { useApplication, useResumes, useSaveApplication } from '../lib/queries';
import { STAGES } from '../lib/types';

const schema = z.object({
  company: z.string().trim().min(1, 'Enter the company name').max(120, 'Keep it under 120 characters'),
  jobTitle: z.string().trim().min(1, 'Enter the job title').max(160, 'Keep it under 160 characters'),
  jobType: z.enum(['internship', 'full_time', 'part_time', 'contract']),
  roleType: z.enum(['engineering', 'data', 'design', 'product', 'business', 'other']),
  sector: z.string().trim().min(1, 'Choose or type a sector').max(60, 'Keep it under 60 characters'),
  location: z.string().trim().max(120, 'Keep it under 120 characters'),
  source: z.string().trim().max(80, 'Keep it under 80 characters'),
  stage: z.enum(STAGES),
  appliedDate: z.string(),
  deadline: z.string(),
  resumeId: z.string(),
  notes: z.string().max(5000, 'Notes can be up to 5,000 characters'),
});
type Values = z.infer<typeof schema>;

const DEFAULTS: Values = {
  company: '',
  jobTitle: '',
  jobType: 'internship',
  roleType: 'engineering',
  sector: '',
  location: '',
  source: '',
  stage: 'saved',
  appliedDate: '',
  deadline: '',
  resumeId: '',
  notes: '',
};

export function ApplicationFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  usePageTitle(editing ? 'Edit application' : 'New application');
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useApplication(id);
  const resumes = useResumes();
  const save = useSaveApplication(id);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  useEffect(() => {
    const a = existing.data;
    if (!a) return;
    reset({
      company: a.company,
      jobTitle: a.jobTitle,
      jobType: a.jobType,
      roleType: a.roleType,
      sector: a.sector,
      location: a.location,
      source: a.source,
      stage: a.stage,
      appliedDate: a.appliedDate ?? '',
      deadline: a.deadline ?? '',
      resumeId: a.resumeId ?? '',
      notes: a.notes,
    });
  }, [existing.data, reset]);

  const notesLength = watch('notes')?.length ?? 0;
  const stage = watch('stage');

  const onSubmit = handleSubmit(async (v) => {
    try {
      const saved = await save.mutateAsync({
        ...v,
        appliedDate: v.appliedDate || null,
        deadline: v.deadline || null,
        resumeId: v.resumeId || null,
      });
      toast.success(editing ? 'Changes saved' : 'Application added', `${saved.company} - ${saved.jobTitle}`);
      navigate(`/applications/${saved.id}`);
    } catch (err) {
      const issues = fieldErrors(err);
      issues.forEach((i) => setError(i.path as keyof Values, { message: i.message }));
      toast.error(editing ? 'Could not save changes' : 'Could not add the application', issues.length ? 'Check the highlighted fields.' : errorMessage(err));
    }
  });

  if (editing && existing.isLoading) return <SkeletonCard h={420} label="Loading application" />;
  if (editing && existing.error) {
    const notFound = existing.error instanceof ApiError && existing.error.status === 404;
    return <ErrorState error={existing.error} title={notFound ? 'Application not found' : 'Could not load this application'} onRetry={notFound ? undefined : () => existing.refetch()} />;
  }

  return (
    <>
      <Link to={editing ? `/applications/${id}` : '/applications'} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> {editing ? 'Back to application' : 'Back to applications'}
      </Link>
      <PageHeader title={editing ? 'Edit application' : 'New application'} description={editing ? 'Update the details. Stage changes are recorded in the activity history.' : 'Capture the role now; you can add interviews and notes later.'} />

      <form onSubmit={onSubmit} noValidate className="stack" style={{ maxWidth: '48rem' }}>
        <Card title="Role">
          <div className="form-grid form-grid--2">
            <TextField label="Company" required autoComplete="organization" error={errors.company?.message} {...register('company')} />
            <TextField label="Job title" required error={errors.jobTitle?.message} {...register('jobTitle')} />
            <SelectField label="Job type" error={errors.jobType?.message} {...register('jobType')}>
              {Object.entries(JOB_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SelectField>
            <SelectField label="Role type" hint="Used for analytics breakdowns." error={errors.roleType?.message} {...register('roleType')}>
              {Object.entries(ROLE_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SelectField>
            <TextField label="Sector" required list="sector-options" error={errors.sector?.message} {...register('sector')} />
            <datalist id="sector-options">
              {SECTOR_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <TextField label="Location" placeholder="City or Remote" error={errors.location?.message} {...register('location')} />
            <TextField label="Source" list="source-options" placeholder="Where did you find it?" error={errors.source?.message} {...register('source')} />
            <datalist id="source-options">
              {SOURCE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </Card>

        <Card title="Progress">
          <div className="form-grid form-grid--2">
            <SelectField label="Stage" hint={STAGE_HINT[stage]} wrapperClassName="span-2" error={errors.stage?.message} {...register('stage')}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </SelectField>
            <TextField label="Applied date" type="date" hint="Leave empty to use today once the stage is past Saved." error={errors.appliedDate?.message} {...register('appliedDate')} />
            <TextField label="Deadline" type="date" error={errors.deadline?.message} {...register('deadline')} />
            <SelectField
              label="Resume"
              wrapperClassName="span-2"
              hint={resumes.data?.length === 0 ? undefined : 'Choose which resume you used for this application.'}
              error={errors.resumeId?.message}
              disabled={resumes.isLoading}
              {...register('resumeId')}
            >
              <option value="">No resume attached</option>
              {resumes.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectField>
            {resumes.data?.length === 0 && (
              <p className="muted span-2" style={{ fontSize: 'var(--fs-sm)', marginTop: 'calc(var(--s-2) * -1)' }}>
                You have no resumes yet. <Link to="/resumes">Upload one</Link> to attach it here.
              </p>
            )}
          </div>
        </Card>

        <Card title="Notes">
          <TextareaField label="Notes" rows={5} hint={`${notesLength.toLocaleString()} / 5,000`} error={errors.notes?.message} placeholder="Recruiter name, prep topics, follow-ups..." {...register('notes')} />
        </Card>

        <div className="form-actions">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={editing && !isDirty}>
            {editing ? 'Save changes' : 'Add application'}
          </Button>
        </div>
      </form>
    </>
  );
}
