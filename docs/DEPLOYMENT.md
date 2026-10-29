# Deployment guide

Order matters: **Supabase, then Render, then Vercel, then wire CORS back to Render.**
Nothing in this repository has been deployed; these are the exact steps to do it.

## 1. Supabase (database, auth, private storage)

1. **Create a project** at supabase.com. Save the database password.
2. **Database URL**: Project Settings > Database > *Connection string*. For Render use the **Session pooler** string (IPv4 compatible, works with `pg`). It looks like
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.
   This is `DATABASE_URL` (backend only).
3. **Run the migration** from your machine (needs Node 20+):
   ```bash
   cd server
   DATABASE_URL="<the string above>" npm run migrate
   ```
   PowerShell: `$env:DATABASE_URL="<...>"; npm run migrate`. It records applied files in `schema_migrations`, so it is safe to repeat.
4. **Optional demo data** for the shared demo student (not needed for real users):
   `DATABASE_URL=... npm run seed` (additive, never deletes). Real users can load/remove sample data from Settings.
5. **Storage bucket**: Storage > New bucket > name `resumes` > **Public bucket: OFF**.
   (If you skip this, the API creates a private `resumes` bucket on first start using the service-role key. If a bucket with that name exists and is public, the API logs an error and you must switch it to private.)
   - Optional hardening: file size limit 5 MB, allowed MIME type `application/pdf`.
   - **Storage policies: add none.** Files are only ever read and written by the API with the service-role key, which bypasses RLS. With no policy on `storage.objects`, the `anon` and `authenticated` roles cannot read or write anything, which is what we want. Do not add a policy that allows public `select`.
6. **API keys**: Project Settings > API:
   - *Project URL* -> `SUPABASE_URL` (server) and `VITE_SUPABASE_URL` (client)
   - *anon / publishable key* -> `VITE_SUPABASE_ANON_KEY` (client; public by design)
   - *service_role key* -> `SUPABASE_SERVICE_ROLE_KEY` (**server only**, never in the client or a `VITE_*` variable)
7. **JWT verification**: Project Settings > JWT Keys (or API > JWT Settings).
   - New projects sign with **asymmetric keys**: set only `SUPABASE_URL`; the API verifies against `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`.
   - Projects still on the legacy **shared secret (HS256)**: also set `SUPABASE_JWT_SECRET` (server only).
8. **Auth settings** (Authentication > URL Configuration): set *Site URL* to your Vercel URL and add it (and `http://localhost:5173` for development) to *Redirect URLs*. Under Providers > Email decide whether *Confirm email* is on; the sign-up screen handles both.

## 2. Render (API)

Create a **Web Service** from this repository (or use the [`render.yaml`](../render.yaml) blueprint).

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Runtime | Node (22 recommended) |
| Build Command | `npm install --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Environment variables:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase session-pooler string |
| `CLIENT_ORIGIN` | your exact Vercel origin, e.g. `https://campus-bridge.vercel.app` (no trailing slash; comma-separate to allow several, e.g. a custom domain) |
| `SUPABASE_URL` | project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key |
| `SUPABASE_JWT_SECRET` | only if on the legacy HS256 secret |
| `SUPABASE_STORAGE_BUCKET` | `resumes` |
| `HEALTH_CHECK_TOKEN` | a long random string (enables diagnostics) |

Do **not** set `DEMO_MODE` (the server refuses it in production by default).

Run migrations either from your machine (step 1.3) or from the Render Shell: `npm run migrate:prod`.

**Verify the deployment**

```bash
curl https://<service>.onrender.com/api/health
# {"status":"ok","service":"campus-bridge-api","time":"..."}

curl -H "x-health-token: <HEALTH_CHECK_TOKEN>" https://<service>.onrender.com/api/health/ready
# {"status":"ready","database":{"ok":true,...},"storage":{"driver":"supabase","ok":true},"auth":{"mode":"supabase-jwt",...}}
```

The diagnostics endpoint returns only booleans, driver names, latency and Postgres error *codes* (for example `28P01` = wrong database password, `ENOTFOUND` = bad host, `migrations_missing`). It never returns connection strings, hostnames or keys, and it is disabled unless `HEALTH_CHECK_TOKEN` is set.

Notes: free Render instances sleep, so the first request after idle can take ~30-60 s. `trust proxy` is set to 1 so rate limiting sees real client IPs.

## 3. Vercel (client)

Import the repository in Vercel.

| Setting | Value |
|---|---|
| Root Directory | `client` |
| Framework Preset | Vite |
| Install Command | `npm install` (default; Vercel installs the workspace from the repo root when "Include files outside the Root Directory" is on, which is the default) |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Environment variables (all public):

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://<service>.onrender.com` (no trailing slash) |
| `VITE_SUPABASE_URL` | project URL |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key |

[`client/vercel.json`](../client/vercel.json) rewrites all paths to `index.html`, so deep links like `/applications/<id>` work on refresh. Leave `VITE_DEMO_MODE` unset in production.

## 4. Wire CORS and test

1. Copy the final Vercel origin into Render's `CLIENT_ORIGIN` and redeploy the API. Preview deployments have different origins; add each one you want to use (comma separated).
2. Sign up on the Vercel site, add an application, upload a PDF, open the preview, and open `/analytics`.
3. Run the checks against the deployed site if you like: `BASE_URL=https://<vercel-url> npm run qa:responsive` (the deployed API requires sign-in, so the authenticated routes will redirect; the script is most useful locally).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Browser console: CORS error | `CLIENT_ORIGIN` does not exactly match the page origin (scheme, host, no trailing slash) |
| Every request 401 after sign-in | `SUPABASE_URL` (or `SUPABASE_JWT_SECRET` for HS256) missing on Render; check `/api/health/ready` `auth` block |
| `/api/health/ready` says `migrations_missing` | Run `npm run migrate` against the production `DATABASE_URL` |
| Database `ECONNREFUSED` / timeout on Render | Use the **Session pooler** string, not the direct IPv6 host |
| Uploads return 503 | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` not set, so no storage driver in production |
| Resume preview opens a JSON error | The signed link expired (60 s) or the object was removed; click Preview again |
