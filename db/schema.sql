-- ===========================================================================
-- Bright Future Secondary School - portal schema
-- Apply with:  psql "$DATABASE_URL" -f db/schema.sql
-- Safe to re-run.
-- ===========================================================================

-- --- The register: who is actually enrolled -------------------------------
-- Source of truth, imported from the school's spreadsheet. Nobody can create
-- an account unless they match a row here.
CREATE TABLE IF NOT EXISTS register (
  id             BIGSERIAL PRIMARY KEY,
  admission_no   TEXT        NOT NULL,
  surname        TEXT        NOT NULL,
  other_names    TEXT        NOT NULL DEFAULT '',
  class_level    TEXT        NOT NULL,
  guardian_email TEXT,
  guardian_phone TEXT,
  status         TEXT        NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'left')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admission numbers are matched case- and space-insensitively.
CREATE UNIQUE INDEX IF NOT EXISTS register_admission_no_key
  ON register (upper(replace(admission_no, ' ', '')));

-- --- Staff register: teacher accounts are checked against this ------------
CREATE TABLE IF NOT EXISTS staff_register (
  id          BIGSERIAL PRIMARY KEY,
  staff_no    TEXT        NOT NULL,
  surname     TEXT        NOT NULL,
  other_names TEXT        NOT NULL DEFAULT '',
  email       TEXT,
  status      TEXT        NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'left')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_register_staff_no_key
  ON staff_register (upper(replace(staff_no, ' ', '')));

-- --- Accounts -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  role          TEXT        NOT NULL CHECK (role IN ('student', 'parent', 'teacher')),
  full_name     TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  phone         TEXT,
  password_hash TEXT        NOT NULL,
  register_id   BIGINT      REFERENCES register(id)       ON DELETE RESTRICT,
  staff_id      BIGINT      REFERENCES staff_register(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,

  -- A student/parent account must point at a register row; a teacher at staff.
  CONSTRAINT users_link_matches_role CHECK (
    (role IN ('student', 'parent') AND register_id IS NOT NULL AND staff_id IS NULL) OR
    (role = 'teacher'              AND staff_id    IS NOT NULL AND register_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

-- One student account and one parent account per enrolled child.
CREATE UNIQUE INDEX IF NOT EXISTS users_register_role_key
  ON users (register_id, role) WHERE register_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_staff_key
  ON users (staff_id) WHERE staff_id IS NOT NULL;

-- --- Sessions -------------------------------------------------------------
-- token_hash holds SHA-256 of the cookie value, never the value itself, so a
-- database leak does not hand over live sessions.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT        PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx  ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx  ON sessions (expires_at);

-- --- Rate limiting --------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_attempts (
  id         BIGSERIAL PRIMARY KEY,
  bucket     TEXT        NOT NULL,
  succeeded  BOOLEAN     NOT NULL DEFAULT false,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_bucket_at_idx ON auth_attempts (bucket, at DESC);
