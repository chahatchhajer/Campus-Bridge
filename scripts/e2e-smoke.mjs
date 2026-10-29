/**
 * End-to-end smoke test through the real UI against a running stack (client + API + Postgres).
 * Creates, edits and deletes its own records, and leaves existing data alone.
 *
 *   npm run dev           (in another terminal; DEMO_MODE/VITE_DEMO_MODE are fine for local review)
 *   npm run e2e:smoke
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

let step = 0;
const ok = (msg) => console.log(`  ok ${++step}. ${msg}`);
const expectVisible = async (locator, msg) => {
  await locator.first().waitFor({ state: 'visible', timeout: 8000 });
  ok(msg);
};
// Remove leftovers from an earlier interrupted run (only records this script creates). Works in demo mode.
const api = async (path, init) => fetch(`${BASE}/api${path}`, init).then((r) => (r.status === 204 ? null : r.json()));
for (const r of (await api('/resumes'))?.data ?? []) if (/^Smoke CV/.test(r.name)) await api(`/resumes/${r.id}`, { method: 'DELETE' });
for (const a of (await api('/applications?search=Smoke%20Test%20Co&pageSize=100'))?.data ?? []) await api(`/applications/${a.id}`, { method: 'DELETE' });

const company = `Smoke Test Co ${Date.now() % 100000}`;

try {
  // --- Validation ---
  await page.goto(`${BASE}/applications/new`);
  await page.getByRole('button', { name: 'Add application' }).click();
  await expectVisible(page.getByText('Enter the company name'), 'empty form shows inline validation errors');
  await expectVisible(page.getByText('Enter the job title'), 'job title error shown too');

  // --- Create ---
  await page.getByLabel('Company').fill(company);
  await page.getByLabel('Job title').fill('QA Engineer Intern');
  await page.getByLabel('Sector').fill('Software');
  await page.getByLabel('Stage').selectOption('applied');
  await page.getByRole('button', { name: 'Add application' }).click();
  await page.waitForURL(/\/applications\/[0-9a-f-]{36}$/);
  await expectVisible(page.getByRole('heading', { name: company }), 'application created and detail page opened');
  await expectVisible(page.getByText(/Added .* as Applied/), 'activity timeline records creation');
  const detailUrl = page.url();

  // --- Move stage ---
  await page.getByRole('button', { name: 'Assessment', exact: true }).click();
  await expectVisible(page.getByText('Moved from Applied to Assessment'), 'stage move persisted and logged');

  // --- Interview ---
  await page.getByRole('button', { name: 'Add round' }).click();
  await page.getByRole('button', { name: 'Add round' }).last().click();
  await expectVisible(page.getByText('Technical', { exact: true }), 'interview round added to timeline');
  await expectVisible(page.getByText(/Scheduled Technical round/), 'interview logged in activity');
  await expectVisible(page.getByText('Moved from Assessment to Interview (interview scheduled)'), 'stage auto-advanced to Interview');

  // --- Resume upload / attach ---
  await page.goto(`${BASE}/resumes`);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  await page.locator('input[type=file]').setInputFiles({ name: 'smoke-cv.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByLabel('Display name').fill('Smoke CV');
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expectVisible(page.getByText('Smoke CV').first(), 'PDF uploaded and listed');

  await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expectVisible(page.getByText('Only PDF files are supported.'), 'non-PDF rejected client-side');
  await page.getByRole('button', { name: 'Cancel' }).click();

  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Preview Smoke CV' }).click()]);
  // The tab opens blank (so popup blockers allow it) and navigates once the API returns the signed URL.
  await popup.waitForURL(/\/api\/files\/local|supabase/, { timeout: 8000 });
  ok('preview opens a short-lived signed URL');
  await popup.close();

  await page.goto(`${detailUrl}/edit`);
  await page.getByLabel('Resume').selectOption({ label: 'Smoke CV' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForURL(detailUrl);
  await expectVisible(page.getByText('Smoke CV').first(), 'resume attached to application');

  // --- Rename + delete resume (confirmation dialog) ---
  await page.goto(`${BASE}/resumes`);
  await page.getByRole('button', { name: 'More actions for Smoke CV' }).click();
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Smoke CV v2');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expectVisible(page.getByText('Smoke CV v2').first(), 'resume renamed');
  await page.getByRole('button', { name: 'More actions for Smoke CV v2' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expectVisible(page.getByRole('dialog', { name: 'Delete this resume?' }), 'delete asks for confirmation');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete resume' }).click();
  await page.getByText('Smoke CV v2').first().waitFor({ state: 'detached', timeout: 8000 });
  ok('resume deleted');

  // --- Search / filter ---
  await page.goto(`${BASE}/applications`);
  await page.getByLabel('Search by company or role').fill(company);
  await expectVisible(page.getByRole('link', { name: company }), 'search finds the new application');
  await page.getByLabel('Filter by stage').selectOption('offer');
  await expectVisible(page.getByText('No applications match these filters'), 'filters combine and show an empty state');
  await page.getByRole('button', { name: 'Clear filters' }).click();

  // --- Calendar + analytics + settings render ---
  await page.goto(`${BASE}/calendar`);
  await expectVisible(page.getByRole('heading', { name: 'Calendar' }), 'calendar renders');
  await page.goto(`${BASE}/analytics`);
  await expectVisible(page.getByText('Interview rate'), 'analytics KPIs render');
  await page.getByRole('button', { name: 'Table' }).first().click();
  await expectVisible(page.getByRole('table', { name: 'Application funnel' }), 'chart has a data-table alternative');
  await page.getByLabel('Job type').selectOption('full_time');
  await expectVisible(page.getByText(/Application funnel/), 'job-type filter applies');

  await page.goto(`${BASE}/settings`);
  await page.getByLabel('Full name').fill('Smoke Tester');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expectVisible(page.getByText('Profile saved'), 'profile saved');

  // --- Delete application with confirmation ---
  await page.goto(detailUrl);
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await expectVisible(page.getByRole('dialog', { name: 'Delete this application?' }), 'application delete asks for confirmation');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete application' }).click();
  await page.waitForURL(`${BASE}/applications`);
  await page.goto(detailUrl);
  await expectVisible(page.getByText('Application not found'), 'deleted application is gone (404 state)');

  await page.goto(`${BASE}/not-a-page`);
  await expectVisible(page.getByText('This page does not exist'), '404 page renders');

  const real = errors.filter((e) => !/404|Failed to load resource/.test(e));
  if (real.length) throw new Error(`console errors: ${real.join(' | ')}`);
  ok('no unexpected console errors');
  console.log('\nE2E smoke passed.');
} catch (err) {
  await page.screenshot({ path: 'e2e-failure.png' }).catch(() => {});
  console.error(`\nE2E smoke FAILED at step ${step + 1}: ${err.message}\n(screenshot: e2e-failure.png, url: ${page.url()})`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
