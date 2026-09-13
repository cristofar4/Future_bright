-- ===========================================================================
-- Bright Future Secondary School - student portal data
-- Apply after db/schema.sql:  psql "$DATABASE_URL" -f db/portal-schema.sql
-- Safe to re-run.
-- ===========================================================================

-- --- Subjects and the people who teach them -------------------------------
CREATE TABLE IF NOT EXISTS subjects (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  -- Drives the tile colour on the dashboard.
  accent     TEXT NOT NULL DEFAULT 'blue'
             CHECK (accent IN ('blue','green','purple','orange','teal','pink','navy')),
  icon       TEXT NOT NULL DEFAULT 'book'
);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_key ON subjects (lower(name));

-- --- Timetable ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timetable (
  id          BIGSERIAL PRIMARY KEY,
  class_level TEXT NOT NULL,
  class_arm   TEXT NOT NULL DEFAULT '',      -- "A" in SS2A; blank means the whole year
  weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 5),   -- 1 = Monday
  starts_at   TIME NOT NULL,
  ends_at     TIME NOT NULL,
  subject_id  BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher     TEXT NOT NULL,
  room        TEXT NOT NULL DEFAULT '',
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS timetable_class_day_idx ON timetable (class_level, class_arm, weekday, starts_at);

-- --- Assignments ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id          BIGSERIAL PRIMARY KEY,
  class_level TEXT NOT NULL,
  class_arm   TEXT NOT NULL DEFAULT '',
  subject_id  BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  brief       TEXT NOT NULL DEFAULT '',
  due_on      DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assignments_class_due_idx ON assignments (class_level, class_arm, due_on DESC);

-- Per-pupil state. No row means not yet submitted.
CREATE TABLE IF NOT EXISTS assignment_submissions (
  assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  register_id   BIGINT NOT NULL REFERENCES register(id)    ON DELETE CASCADE,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  score         NUMERIC(5,2),
  PRIMARY KEY (assignment_id, register_id)
);

-- --- Results --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subject_results (
  id          BIGSERIAL PRIMARY KEY,
  register_id BIGINT NOT NULL REFERENCES register(id) ON DELETE CASCADE,
  subject_id  BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  session     TEXT NOT NULL,                 -- e.g. 2024/2025
  term        SMALLINT NOT NULL CHECK (term BETWEEN 1 AND 3),
  score       NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  UNIQUE (register_id, subject_id, session, term)
);

-- --- Attendance -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id          BIGSERIAL PRIMARY KEY,
  register_id BIGINT NOT NULL REFERENCES register(id) ON DELETE CASCADE,
  on_date     DATE NOT NULL,
  state       TEXT NOT NULL CHECK (state IN ('present','absent','late')),
  UNIQUE (register_id, on_date)
);
CREATE INDEX IF NOT EXISTS attendance_register_idx ON attendance (register_id, on_date DESC);

-- --- Announcements --------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id           BIGSERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  published_on DATE NOT NULL DEFAULT current_date,
  audience     TEXT NOT NULL DEFAULT 'all'
               CHECK (audience IN ('all','students','parents','staff'))
);
CREATE INDEX IF NOT EXISTS announcements_published_idx ON announcements (published_on DESC);

-- --- Messages -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender       TEXT NOT NULL,
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS messages_user_idx ON messages (user_id, sent_at DESC);

-- --- Term calendar --------------------------------------------------------
-- One row per term, so the dashboard can show the term name and days remaining
-- instead of hard-coding them.
CREATE TABLE IF NOT EXISTS terms (
  id       BIGSERIAL PRIMARY KEY,
  session  TEXT NOT NULL,
  term     SMALLINT NOT NULL CHECK (term BETWEEN 1 AND 3),
  label    TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on   DATE NOT NULL,
  UNIQUE (session, term),
  CHECK (ends_on > starts_on)
);

-- --- Class arm ------------------------------------------------------------
-- SS2A is class_level SS2 plus arm A. Added here rather than in the auth
-- schema so sign-up keeps asking only for the year group.
ALTER TABLE register ADD COLUMN IF NOT EXISTS class_arm TEXT NOT NULL DEFAULT '';
