import { zodResolver } from '@hookform/resolvers/zod';
import { Download, FlaskConical, LogOut, Trash2, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/Button';
import { Card, PageHeader, usePageTitle } from '../components/ui/Bits';
import { ConfirmDialog } from '../components/ui/Dialog';
import { ErrorState, SkeletonCard } from '../components/ui/Feedback';
import { SelectField, TextField } from '../components/ui/Form';
import { useToast } from '../components/ui/Toast';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { useAuth } from '../lib/auth';
import { downloadJson } from '../lib/files';
import { useDashboard, useProfile, useSampleData, useUpdateProfile, useWipeData } from '../lib/queries';

const thisYear = new Date().getFullYear();
const schema = z.object({
  fullName: z.string().trim().max(120, 'Keep it under 120 characters'),
  university: z.string().trim().max(120, 'Keep it under 120 characters'),
  department: z.string().trim().max(120, 'Keep it under 120 characters'),
  graduationYear: z.string().refine((v) => v === '' || (Number(v) >= 2000 && Number(v) <= 2100), 'Choose a valid year'),
  defaultView: z.enum(['table', 'board']),
  deadlineReminders: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function SettingsPage() {
  usePageTitle('Settings');
  const toast = useToast();
  const navigate = useNavigate();
  const auth = useAuth();
  const { data: profile, isLoading, error, refetch } = useProfile();
  const dashboard = useDashboard();
  const update = useUpdateProfile();
  const sample = useSampleData();
  const wipe = useWipeData();
  const [confirm, setConfirm] = useState<'sample' | 'wipe' | 'account' | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', university: '', department: '', graduationYear: '', defaultView: 'table', deadlineReminders: true },
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      fullName: profile.fullName,
      university: profile.university,
      department: profile.department,
      graduationYear: profile.graduationYear ? String(profile.graduationYear) : '',
      defaultView: profile.preferences.defaultView,
      deadlineReminders: profile.preferences.deadlineReminders,
    });
  }, [profile, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync({
        fullName: v.fullName,
        university: v.university,
        department: v.department,
        graduationYear: v.graduationYear ? Number(v.graduationYear) : null,
        preferences: { defaultView: v.defaultView, deadlineReminders: v.deadlineReminders },
      });
      toast.success('Profile saved');
    } catch (err) {
      fieldErrors(err).forEach((i) => setError(i.path as keyof Values, { message: i.message }));
      toast.error('Could not save your profile', errorMessage(err));
    }
  });

  async function exportData() {
    setExporting(true);
    try {
      const res = await api<unknown>('/profile/export');
      // The export endpoint returns the document itself (not wrapped in { data }).
      downloadJson('campus-bridge-export.json', res);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error('Could not export your data', errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  async function runConfirmed() {
    try {
      if (confirm === 'sample') {
        const r = await sample.remove.mutateAsync();
        toast.success(`Removed ${r.removed} sample applications`);
      } else if (confirm === 'wipe') {
        await wipe.mutateAsync();
        toast.success('All of your data was deleted', 'Your account and profile remain.');
      } else if (confirm === 'account') {
        setAccountBusy(true);
        await api('/profile', { method: 'DELETE' });
        await auth.signOut();
        toast.success('Account deleted');
        navigate('/', { replace: true });
      }
      setConfirm(null);
    } catch (err) {
      toast.error('That did not work', errorMessage(err));
    } finally {
      setAccountBusy(false);
    }
  }

  async function loadSample() {
    try {
      const r = await sample.load.mutateAsync();
      toast.success(`Loaded ${r.inserted} fictional applications`);
    } catch (err) {
      toast.error('Could not load sample data', errorMessage(err));
    }
  }

  if (isLoading) return <SkeletonCard h={380} label="Loading settings" />;
  if (error || !profile) return <ErrorState error={error} onRetry={refetch} title="Could not load your profile" />;

  const years = Array.from({ length: 9 }, (_, i) => thisYear - 2 + i);
  const hasSample = (dashboard.data?.kpis.totalApplications ?? 0) > 0;

  return (
    <>
      <PageHeader title="Settings" description="Your profile, preferences and data." />
      <div className="stack" style={{ maxWidth: '46rem' }}>
        <form onSubmit={onSubmit} noValidate className="stack">
          <Card title="Profile" subtitle={auth.isDemo ? 'Demo account: shared and not secure.' : (profile.email ?? undefined)}>
            <div className="form-grid form-grid--2">
              <TextField label="Full name" autoComplete="name" wrapperClassName="span-2" error={errors.fullName?.message} {...register('fullName')} />
              <TextField label="University" autoComplete="organization" error={errors.university?.message} {...register('university')} />
              <TextField label="Department" error={errors.department?.message} {...register('department')} />
              <SelectField label="Graduation year" error={errors.graduationYear?.message} {...register('graduationYear')}>
                <option value="">Not set</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </SelectField>
            </div>
          </Card>

          <Card title="Preferences">
            <div className="form-grid">
              <SelectField label="Default applications view" {...register('defaultView')}>
                <option value="table">Table</option>
                <option value="board">Board</option>
              </SelectField>
              <Controller
                control={control}
                name="deadlineReminders"
                render={({ field }) => (
                  <div className="switch-row">
                    <div>
                      <label htmlFor="pref-deadlines" className="field__label">
                        Highlight deadlines due within 3 days
                      </label>
                      <p className="field__hint">Shows due-soon dates in red on the dashboard, applications and board. In-app only; this prototype sends no email or push notifications.</p>
                    </div>
                    <input id="pref-deadlines" type="checkbox" role="switch" className="switch" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  </div>
                )}
              />
            </div>
          </Card>

          <div className="form-actions">
            <Button variant="secondary" onClick={() => reset()} disabled={!isDirty || isSubmitting}>
              Discard changes
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>

        <Card title="Your data" subtitle="You own what you add here.">
          <div className="setting-actions">
            <div>
              <h3>Export my data</h3>
              <p className="muted">Download your profile, applications, interviews and activity as JSON. Resume files are downloaded from the Resumes page.</p>
            </div>
            <Button onClick={exportData} loading={exporting}>
              <Download aria-hidden="true" /> Export JSON
            </Button>
          </div>
          <hr />
          <div className="setting-actions">
            <div>
              <h3>Fictional sample data</h3>
              <p className="muted">Load or remove a labelled set of invented applications to explore the product and analytics. Sample rows never mix with your own unless you add them.</p>
            </div>
            <div className="row">
              <Button onClick={loadSample} loading={sample.load.isPending}>
                <FlaskConical aria-hidden="true" /> Load sample data
              </Button>
              <Button variant="danger-quiet" onClick={() => setConfirm('sample')} disabled={!hasSample}>
                Remove sample data
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Account actions">
          <div className="setting-actions">
            <div>
              <h3>Delete all my data</h3>
              <p className="muted">Permanently removes every application, interview, activity entry and resume file. Your profile and sign-in stay.</p>
            </div>
            <Button variant="danger-quiet" onClick={() => setConfirm('wipe')}>
              <Trash2 aria-hidden="true" /> Delete data
            </Button>
          </div>
          <hr />
          {auth.isDemo ? (
            <p className="muted">Sign-out and account deletion are unavailable in the shared demo account.</p>
          ) : (
            <>
              <div className="setting-actions">
                <div>
                  <h3>Sign out</h3>
                  <p className="muted">Signed in as {auth.email}.</p>
                </div>
                <Button
                  onClick={async () => {
                    await auth.signOut();
                    navigate('/');
                  }}
                >
                  <LogOut aria-hidden="true" /> Sign out
                </Button>
              </div>
              <hr />
              <div className="setting-actions">
                <div>
                  <h3>Delete my account</h3>
                  <p className="muted">Deletes your data, your profile and (when the server has admin access) your sign-in. This cannot be undone.</p>
                </div>
                <Button variant="danger" onClick={() => setConfirm('account')}>
                  <UserX aria-hidden="true" /> Delete account
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'sample'}
        title="Remove sample data?"
        description="Only the rows labelled as fictional sample data are deleted. Your own applications are untouched."
        confirmLabel="Remove sample data"
        busy={sample.remove.isPending}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'wipe'}
        title="Delete all your data?"
        description="Every application, interview, activity entry and resume file you own will be permanently deleted. This cannot be undone."
        confirmLabel="Delete everything"
        busy={wipe.isPending}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'account'}
        title="Delete your account?"
        description="Your data, profile and sign-in will be permanently removed and you will be signed out. This cannot be undone."
        confirmLabel="Delete account"
        busy={accountBusy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
