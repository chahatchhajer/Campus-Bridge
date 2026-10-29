# Campus Bridge

A placement and internship tracker for students, with a built-in analytics module called **GDG Edge**.
This is a **portfolio and recruitment prototype**: it is fully wired (React, Express, PostgreSQL, private file storage), but it has not been security-audited and all sample data is **fictional**.

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query, React Hook Form + Zod, Recharts, Lucide icons, hand-written CSS with design tokens |
| Backend | Node.js, Express 5, TypeScript, `pg` (parameterized SQL only), Zod, Helmet, CORS allow-list, rate limiting, Multer |
| Database | Supabase PostgreSQL (plain SQL migrations in [`server/migrations`](server/migrations)) |
| Auth | Supabase Auth; the API verifies JWTs (JWKS or HS256 secret) on every request |
| Files | Private Supabase Storage bucket, signed URLs issued by the API after an ownership check |
| Deploy | Vercel (client), Render Web Service (server) |

```
client/    React app            (deploys to Vercel)
server/    Express API          (deploys to Render)
  migrations/   SQL schema
  src/          app, routes, repos (SQL), analytics (SQL), storage, auth
  scripts/      migrate, seed, dev-db (throwaway local Postgres)
  tests/        unit + integration tests (real PostgreSQL)
scripts/   qa-responsive.mjs, e2e-smoke.mjs (browser checks)
docs/      DEPLOYMENT.md, DESIGN.md
```

## What works where

| | Locally with no accounts | Needs your Supabase project |
|---|---|---|
| Landing page, app shell, all screens, charts | yes | |
| Applications, interviews, activity, calendar, dashboard, settings | yes (embedded Postgres) | |
| GDG Edge analytics (real SQL aggregates) | yes | |
| Resume upload / preview / download / delete | yes, using a **local-disk driver** that mimics signed URLs | production uses the private Supabase bucket |
| Sign-up / sign-in, per-user isolation | **demo mode only** (shared account, insecure) | real Supabase Auth |
| Deployed site | | requires Supabase + Render + Vercel accounts (not done by this repo) |

Nothing here has been deployed. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Run it locally (no Supabase needed)

Requires Node 20+.

```bash
npm install

# 1. A throwaway local PostgreSQL (no Docker / install needed). Keep this terminal open.
npm run dev:db -w server        # listens on :54329 and applies migrations

# 2. Env files (already templated)
cp server/.env.example server/.env    # then set DEMO_MODE=true for local review
cp client/.env.example client/.env    # then set VITE_DEMO_MODE=true

# 3. Fictional demo data, then start API (:4000) and client (:5173)
npm run seed
npm run dev
```

Open http://localhost:5173. In demo mode there is no sign-in and everyone shares one account; a banner says so on every screen.
`DEMO_MODE` is **refused** by the server when `NODE_ENV=production` unless you also set `ALLOW_PUBLIC_DEMO=true`.

Using your own Postgres instead? Set `DATABASE_URL` in `server/.env` and run `npm run migrate`.

### Root scripts

| Script | What it does |
|---|---|
| `npm run dev` | API and client together |
| `npm run build` | Compile the server and build the client |
| `npm run check` | Type-check both workspaces |
| `npm test` | Server unit + integration tests (starts its own temporary PostgreSQL) |
| `npm run migrate` | Apply pending SQL migrations (`server`: `migrate:prod` runs the compiled version) |
| `npm run seed` | Add the fictional demo student's data. Additive and repeatable; deletes nothing |
| `npm run seed:reset` | **Disposable local DBs only.** Deletes the demo student's rows first. Refuses to run without `ALLOW_DESTRUCTIVE_SEED=yes` and in production |
| `npm run qa:responsive` | Visits every route at 360/390/768/1024/1440/1920px; fails on overflow, console errors, failed API calls (`SHOTS=1` saves screenshots) |
| `npm run e2e:smoke` | Drives the real UI through create, edit, stage move, interview, upload, attach, delete, analytics |

## Environment variables

Backend (`server/.env`, **never** in the client):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Backend only. SSL is automatic for non-localhost hosts |
| `CLIENT_ORIGIN` | Exact frontend origin(s) for CORS, comma separated. Required in production; no wildcard |
| `SUPABASE_URL` | Project URL. Used to verify JWTs (JWKS) and for Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only. Private Storage and optional account deletion |
| `SUPABASE_JWT_SECRET` | Only if the project still uses the legacy HS256 secret |
| `SUPABASE_STORAGE_BUCKET` | Private bucket name (default `resumes`) |
| `HEALTH_CHECK_TOKEN` | Enables `GET /api/health/ready` for deployment diagnostics |
| `DEMO_MODE`, `ALLOW_PUBLIC_DEMO` | Insecure demo identity (see above) |

Frontend (`client/.env`, public by design):

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Render service URL (empty locally; Vite proxies `/api`) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Public Auth config |
| `VITE_DEMO_MODE` | Local visual review only |

## Security model

- **Identity comes only from a verified JWT** (`sub`, with issuer and audience checks). The user id is never read from the body, query or headers. There is no header-based admin or organizer role.
- Every SQL statement is parameterized and filtered by `user_id`; foreign keys also keep applications, interviews and resumes in the same owner scope. Tests prove user B cannot read, change, delete or attach user A's records.
- RLS is enabled on every table with no policies, which blocks Supabase's public REST API; the Express API connects with `DATABASE_URL`.
- Uploads: PDF only, 5 MB, MIME type **and** `%PDF-` signature checked, storage path generated on the server, bucket private, 60-second signed URLs after an ownership check, cleanup on failed insert, and a clear warning when file cleanup fails on delete.
- Body size limit, global and upload rate limits, Helmet headers, safe error bodies, health endpoint that exposes nothing.
- **Not included:** malware scanning of uploads, email verification flows beyond Supabase's, audit logging, backups beyond what Supabase provides, and a third-party security review.

## GDG Edge metric definitions

All figures are SQL aggregates (`COUNT ... FILTER`, `DATE_TRUNC`, `GROUP BY`, `generate_series`) in [`server/src/analytics.ts`](server/src/analytics.ts), and every rate returns `{ numerator, denominator, percent }` (percent is `null` when the denominator is zero, shown as "n/a", never 0%).

- **Submitted**: stage is past *Saved*.
- **Reached interview**: submitted and (has at least one interview round, or stage is Interview/Offer). Rejected applications that had interviews still count.
- **Interview rate** = reached interview ÷ submitted. **Offer rate** = offers ÷ submitted.
- **Application → interview** = reached interview ÷ *answered* applications (reached interview, offer or rejected). Applications still waiting are excluded instead of counted as failures.
- **Interview → offer** = offers ÷ reached interview.
- Date filters and monthly buckets use `COALESCE(applied_date, created_at::date)`.

The seed and the "Load sample data" button insert clearly fictional records flagged `is_demo`; the analytics screen shows a banner whenever sample records are in the view.

## Known limitations

- Not deployed by this repo; Supabase Auth settings (site URL, email confirmation) are manual dashboard steps.
- No email/push notifications. The only reminder-related preference highlights due-soon dates inside the app.
- Board drag-and-drop uses native HTML5 drag events (desktop). Touch and keyboard users use the "Move to" select on each card.
- The initial JS bundle is ~195 kB gzip (Supabase client, forms, icons); Recharts is split into a lazy chunk.
- Light theme only. Dates use the viewer's locale; "due in N days" and the dashboard deadline counts are based on server UTC days.
- Tests run on a local PostgreSQL 18. Supabase-specific paths (JWKS verification against a live project, the Storage SDK) are implemented but can only be verified with your credentials; the local-disk storage driver and HS256 tokens exercise the same code paths in tests.
