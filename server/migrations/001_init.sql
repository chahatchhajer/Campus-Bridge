-- Campus Bridge schema. Idempotent enough to re-run on a fresh database;
-- the migration runner records applied files in schema_migrations.
--
-- Ownership model: every row is owned by exactly one student (profiles.id).
-- profiles.id equals the Supabase Auth user id (the JWT `sub` claim). There is
-- deliberately no FK to auth.users so the schema also runs on plain Postgres
-- (local development, tests, and the demo user).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE profiles (
  id               uuid PRIMARY KEY,
  email            text,
  full_name        text NOT NULL DEFAULT '',
  university       text NOT NULL DEFAULT '',
  department       text NOT NULL DEFAULT '',
  graduation_year  smallint CHECK (graduation_year BETWEEN 2000 AND 2100),
  preferences      jsonb NOT NULL DEFAULT '{"deadlineReminders": true, "defaultView": "table"}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resumes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  original_filename text NOT NULL,
  -- Server-generated object path inside the private bucket: <user_id>/<resume_id>.pdf
  storage_path      text NOT NULL UNIQUE,
  mime_type         text NOT NULL DEFAULT 'application/pdf',
  size_bytes        integer NOT NULL CHECK (size_bytes > 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resumes_user_idx ON resumes (user_id, created_at DESC);

CREATE TABLE applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company       text NOT NULL CHECK (char_length(company) BETWEEN 1 AND 120),
  sector        text NOT NULL DEFAULT 'Other' CHECK (char_length(sector) BETWEEN 1 AND 60),
  job_title     text NOT NULL CHECK (char_length(job_title) BETWEEN 1 AND 160),
  job_type      text NOT NULL DEFAULT 'internship'
                CHECK (job_type IN ('internship', 'full_time', 'part_time', 'contract')),
  role_type     text NOT NULL DEFAULT 'engineering'
                CHECK (role_type IN ('engineering', 'data', 'design', 'product', 'business', 'other')),
  location      text NOT NULL DEFAULT '',
  source        text NOT NULL DEFAULT '',
  stage         text NOT NULL DEFAULT 'saved'
                CHECK (stage IN ('saved', 'applied', 'assessment', 'interview', 'offer', 'rejected')),
  applied_date  date,
  deadline      date,
  notes         text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  resume_id     uuid REFERENCES resumes(id) ON DELETE SET NULL,
  -- true for rows inserted by the fictional sample-data loader / seed script
  is_demo       boolean NOT NULL DEFAULT false,
  stage_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX applications_user_stage_idx    ON applications (user_id, stage);
CREATE INDEX applications_user_applied_idx  ON applications (user_id, applied_date DESC);
CREATE INDEX applications_user_deadline_idx ON applications (user_id, deadline) WHERE deadline IS NOT NULL;
CREATE INDEX applications_user_created_idx  ON applications (user_id, created_at DESC);
CREATE INDEX applications_resume_idx        ON applications (resume_id) WHERE resume_id IS NOT NULL;

CREATE TABLE interviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  -- Denormalised owner so every interview query can be scoped by user_id directly.
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  round_type     text NOT NULL DEFAULT 'technical'
                 CHECK (round_type IN ('phone_screen', 'technical', 'behavioral', 'hr', 'onsite', 'other')),
  scheduled_at   timestamptz NOT NULL,
  status         text NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  outcome        text NOT NULL DEFAULT 'pending'
                 CHECK (outcome IN ('pending', 'passed', 'failed')),
  notes          text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 3000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interviews_application_idx  ON interviews (application_id, scheduled_at);
CREATE INDEX interviews_user_schedule_idx ON interviews (user_id, scheduled_at);

CREATE TABLE application_activity (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type           text NOT NULL
                 CHECK (type IN ('created', 'updated', 'stage_changed', 'interview_added',
                                 'interview_updated', 'interview_removed', 'resume_attached', 'note')),
  message        text NOT NULL,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_application_idx ON application_activity (application_id, created_at DESC);
CREATE INDEX activity_user_idx        ON application_activity (user_id, created_at DESC);

-- Keep updated_at honest without relying on every handler remembering it.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at     BEFORE UPDATE ON profiles     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER resumes_updated_at      BEFORE UPDATE ON resumes      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER interviews_updated_at   BEFORE UPDATE ON interviews   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Defence in depth for Supabase: the Express API connects with the database
-- owner role (via DATABASE_URL) and enforces ownership in SQL. Enabling RLS with
-- no policies blocks direct access through Supabase's public PostgREST API
-- (anon / authenticated roles), which this app never uses.
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_activity ENABLE ROW LEVEL SECURITY;
