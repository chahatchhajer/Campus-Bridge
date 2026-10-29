import { FlaskConical, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../lib/api';
import { toDateInput, todayInput } from '../lib/format';
import { useSampleData, useSaveApplication } from '../lib/queries';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

const DEMO_COMPANIES = ['Northwind Lantern Labs', 'Birchwood Analytics', 'Cobalt Harbor Systems', 'Maple & Slate Studio', 'Quarry Lane Robotics'];

/** Empty-state actions: one fictional application, or the full fictional sample dataset. */
export function SampleActions() {
  const toast = useToast();
  const navigate = useNavigate();
  const save = useSaveApplication();
  const sample = useSampleData();

  async function addOne() {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 12);
    try {
      const created = await save.mutateAsync({
        company: `${DEMO_COMPANIES[Math.floor(Math.random() * DEMO_COMPANIES.length)]} (demo)`,
        jobTitle: 'Software Engineering Intern',
        jobType: 'internship',
        roleType: 'engineering',
        sector: 'Software',
        location: 'Remote',
        source: 'Company website',
        stage: 'applied',
        appliedDate: todayInput(),
        deadline: toDateInput(deadline),
        notes: 'Fictional demo application. Delete it any time.',
      });
      toast.success('Demo application added', 'It is fictional, so edit or delete it freely.');
      navigate(`/applications/${created.id}`);
    } catch (err) {
      toast.error('Could not add the demo application', errorMessage(err));
    }
  }

  async function loadSample() {
    try {
      const r = await sample.load.mutateAsync();
      toast.success(`Loaded ${r.inserted} fictional applications`, 'Everything is labelled as sample data and can be removed in Settings.');
    } catch (err) {
      toast.error('Could not load sample data', errorMessage(err));
    }
  }

  return (
    <>
      <Button variant="primary" onClick={addOne} loading={save.isPending}>
        <Plus aria-hidden="true" /> Add a demo application
      </Button>
      <Button onClick={loadSample} loading={sample.load.isPending}>
        <FlaskConical aria-hidden="true" /> Load fictional sample data
      </Button>
    </>
  );
}
