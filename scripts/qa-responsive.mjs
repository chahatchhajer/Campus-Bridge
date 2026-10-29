/**
 * Responsive QA: visits every route at the required widths using the locally installed Edge/Chrome
 * (no browser download), and fails on horizontal overflow, console errors or failed API requests.
 *
 *   1. npm run dev            (client + API; use DEMO_MODE / VITE_DEMO_MODE for review without Supabase)
 *   2. npm run qa:responsive  (BASE_URL defaults to http://localhost:5173, SHOTS=1 saves screenshots)
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const SHOTS = process.env.SHOTS === '1';
const WIDTHS = [
  { w: 360, h: 740 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1024, h: 768 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge' });

// Find a real application id for the detail route.
const probe = await fetch(`${BASE}/api/applications?pageSize=1`).then((r) => r.json()).catch(() => null);
const appId = probe?.data?.[0]?.id;

const ROUTES = [
  '/',
  '/login',
  '/dashboard',
  '/applications',
  '/applications?view=board',
  '/applications/new',
  ...(appId ? [`/applications/${appId}`, `/applications/${appId}/edit`] : []),
  '/calendar',
  '/resumes',
  '/analytics',
  '/settings',
  '/privacy',
  '/does-not-exist',
];

if (SHOTS) mkdirSync('qa-screenshots', { recursive: true });
let failures = 0;

for (const { w, h } of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const problems = [];
    page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text().slice(0, 160)}`));
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`));
    page.on('response', (r) => {
      if (r.url().includes('/api/') && r.status() >= 400 && !route.includes('does-not-exist')) problems.push(`http ${r.status()} ${new URL(r.url()).pathname}`);
    });
    await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch((e) => problems.push(`nav: ${e.message.slice(0, 100)}`));
    await page.waitForTimeout(700); // charts animate in

    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const bad = [];
      if (de.scrollWidth > de.clientWidth + 1) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.right > de.clientWidth + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
            const inScroller = el.closest('.board, .table-wrap, .segmented');
            if (!inScroller) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} right=${Math.round(r.right)}`);
          }
          if (bad.length > 4) break;
        }
      }
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, bad };
    });
    if (overflow.scrollWidth > overflow.clientWidth + 1) problems.push(`HORIZONTAL OVERFLOW ${overflow.scrollWidth}>${overflow.clientWidth} ${overflow.bad.join(' | ')}`);

    if (SHOTS) await page.screenshot({ path: `qa-screenshots/${w}${route.replace(/[^\w]+/g, '_') || '_home'}.png`, fullPage: false });
    if (problems.length) {
      failures += 1;
      console.log(`FAIL ${w}px ${route}\n   ${problems.join('\n   ')}`);
    }
    await page.close();
  }
  await ctx.close();
  console.log(`checked ${ROUTES.length} routes at ${w}px`);
}

await browser.close();
if (failures) {
  console.log(`\n${failures} route/width combination(s) had problems.`);
  process.exit(1);
}
console.log('\nAll routes passed at all widths: no horizontal overflow, console errors or failed API calls.');
