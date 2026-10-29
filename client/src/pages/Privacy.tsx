import { Link } from 'react-router-dom';
import { Card, PageHeader, usePageTitle } from '../components/ui/Bits';
import { Notice } from '../components/ui/Feedback';

export function PrivacyPage() {
  usePageTitle('Privacy');
  return (
    <>
      <PageHeader title="Privacy and data handling" description="How this prototype treats your data, written plainly, including what it does not do." />
      <div className="stack prose" style={{ maxWidth: '46rem' }}>
        <Notice tone="warn">
          Campus Bridge is a <strong>portfolio and recruitment prototype</strong>. It has not had a security audit and is not a managed service. Do not store information you would not be comfortable losing or exposing.
        </Notice>

        <Card title="What is stored">
          <ul className="bullets">
            <li>
              <strong>Account:</strong> your email and a user id from Supabase Auth, plus a profile (name, university, department, graduation year, preferences).
            </li>
            <li>
              <strong>Tracker data:</strong> applications, interview rounds, notes and an activity history, saved in PostgreSQL. Every row belongs to exactly one user id, and every query is filtered by the id taken from your verified session token.
            </li>
            <li>
              <strong>Resumes:</strong> PDF files in a private Supabase Storage bucket, with metadata (name, size, owner) in PostgreSQL.
            </li>
          </ul>
        </Card>

        <Card title="How files are protected">
          <ul className="bullets">
            <li>The bucket is private: files have no public URL.</li>
            <li>Uploads go through the API, which accepts PDFs up to 5 MB, checks the file signature, and chooses the storage path itself.</li>
            <li>To view or download, the API first confirms the resume is yours, then issues a link that expires after 60 seconds.</li>
            <li>
              <strong>No malware scanning.</strong> Uploads are not scanned for malicious content in this prototype.
            </li>
          </ul>
        </Card>

        <Card title="Demo and sample data">
          <ul className="bullets">
            <li>
              Sample data is <strong>fictional</strong>: invented companies, roles and outcomes. It is labelled as sample data wherever it appears and can be removed in <Link to="/settings">Settings</Link>.
            </li>
            <li>Analytics shown on the landing page use the same fictional data and make no claim about real placement rates or any real employer.</li>
            <li>
              A local-only demo mode can bypass sign-in so the interface can be reviewed. In that mode everyone shares one account, which is <strong>not secure</strong>, and it is refused on production servers by default.
            </li>
          </ul>
        </Card>

        <Card title="Your controls">
          <ul className="bullets">
            <li>Export everything you have stored as JSON, from Settings.</li>
            <li>Delete all of your data, or your whole account, from Settings. Deleting a resume also deletes its stored file; if file cleanup ever fails, you are told.</li>
          </ul>
        </Card>

        <Card title="Limitations">
          <ul className="bullets">
            <li>No email, push or SMS notifications are sent. Preferences only affect what the app highlights on screen.</li>
            <li>Backups and retention depend on your Supabase project settings, not on this app.</li>
            <li>The app does not use advertising or third-party analytics trackers. Web fonts are loaded from Google Fonts.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
