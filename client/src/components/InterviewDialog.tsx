import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage, fieldErrors } from '../lib/api';
import { INTERVIEW_STATUS_LABEL, OUTCOME_LABEL, ROUND_LABEL } from '../lib/constants';
import { fromDateTimeLocal, toDateTimeLocal } from '../lib/format';
import { useSaveInterview } from '../lib/queries';
import type { Interview } from '../lib/types';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { SelectField, TextField, TextareaField } from './ui/Form';
import { useToast } from './ui/Toast';

const schema = z.object({
  roundType: z.enum(['phone_screen', 'technical', 'behavioral', 'hr', 'onsite', 'other']),
  scheduledAt: z.string().min(1, 'Choose a date and time').refine((v) => !Number.isNaN(new Date(v).getTime()), 'Choose a valid date and time'),
  status: z.enum(['scheduled', 'completed', 'cancelled']),
  outcome: z.enum(['pending', 'passed', 'failed']),
  notes: z.string().max(3000, 'Notes can be up to 3,000 characters'),
});
type Values = z.infer<typeof schema>;

function defaultsFor(i?: Interview | null): Values {
  if (i) return { roundType: i.roundType, scheduledAt: toDateTimeLocal(i.scheduledAt), status: i.status, outcome: i.outcome, notes: i.notes };
  const t = new Date();
  t.setDate(t.getDate() + 3);
  t.setHours(10, 0, 0, 0);
  return { roundType: 'technical', scheduledAt: toDateTimeLocal(t.toISOString()), status: 'scheduled', outcome: 'pending', notes: '' };
}

export function InterviewDialog({ open, onClose, applicationId, interview }: { open: boolean; onClose: () => void; applicationId: string; interview?: Interview | null }) {
  const toast = useToast();
  const save = useSaveInterview(applicationId, interview?.id);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaultsFor(interview) });

  useEffect(() => {
    if (open) reset(defaultsFor(interview));
  }, [open, interview, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const res = (await save.mutateAsync({ ...v, scheduledAt: fromDateTimeLocal(v.scheduledAt) })) as { stageAdvanced?: boolean };
      toast.success(interview ? 'Interview updated' : 'Interview round added');
      if (res?.stageAdvanced) toast.info('Moved to the Interview stage', 'Booking a round advances the application automatically.');
      onClose();
    } catch (err) {
      const issues = fieldErrors(err);
      issues.forEach((i) => setError(i.path as keyof Values, { message: i.message }));
      toast.error('Could not save the interview', issues.length ? 'Check the highlighted fields.' : errorMessage(err));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!isSubmitting}
      title={interview ? 'Edit interview round' : 'Add interview round'}
      description="Record when it happens and how it went."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="interview-form" loading={isSubmitting}>
            {interview ? 'Save round' : 'Add round'}
          </Button>
        </>
      }
    >
      <form id="interview-form" onSubmit={onSubmit} noValidate className="form-grid form-grid--2">
        <SelectField label="Round type" error={errors.roundType?.message} {...register('roundType')}>
          {Object.entries(ROUND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </SelectField>
        <TextField label="Date and time" type="datetime-local" required error={errors.scheduledAt?.message} {...register('scheduledAt')} />
        <SelectField label="Status" error={errors.status?.message} {...register('status')}>
          {Object.entries(INTERVIEW_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </SelectField>
        <SelectField label="Outcome" error={errors.outcome?.message} {...register('outcome')}>
          {Object.entries(OUTCOME_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </SelectField>
        <TextareaField label="Notes" wrapperClassName="span-2" rows={4} placeholder="Interviewers, topics, feedback..." error={errors.notes?.message} {...register('notes')} />
      </form>
    </Dialog>
  );
}
