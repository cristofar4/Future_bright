-- ===========================================================================
-- Demo portal data. Mirrors the dashboard design so the page can be seen
-- working before real school data is loaded. Do NOT load into production.
-- Safe to re-run.
-- ===========================================================================

INSERT INTO subjects (name, accent, icon) VALUES
  ('Mathematics',      'blue',   'calc'),
  ('English Language', 'purple', 'book'),
  ('Biology',          'green',  'leaf'),
  ('Computer Studies', 'teal',   'laptop'),
  ('Physics',          'orange', 'atom'),
  ('Chemistry',        'pink',   'flask')
ON CONFLICT (lower(name)) DO NOTHING;

INSERT INTO terms (session, term, label, starts_on, ends_on) VALUES
  ('2024/2025', 1, 'First Term',  DATE '2024-09-09', DATE '2024-12-13'),
  ('2024/2025', 2, 'Second Term', current_date - 22, current_date + 68),
  ('2024/2025', 3, 'Third Term',  current_date + 90, current_date + 180)
ON CONFLICT (session, term) DO UPDATE
  SET starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on;

-- Daniel James, the pupil shown in the dashboard design.
INSERT INTO register (admission_no, surname, other_names, class_level, class_arm,
                      guardian_email, guardian_phone, status, source)
VALUES ('BFS/2024/0178', 'James', 'Daniel', 'SS2', 'A',
        'mrs.james@example.com', '+234 806 222 3344', 'active', 'demo')
ON CONFLICT (upper(replace(admission_no, ' ', ''))) DO UPDATE
  SET class_arm = EXCLUDED.class_arm, other_names = EXCLUDED.other_names;

-- Give the other demo pupils an arm too.
UPDATE register SET class_arm = 'A' WHERE class_arm = '';

-- --- Timetable for SS2A ---------------------------------------------------
DELETE FROM timetable WHERE class_level = 'SS2' AND class_arm = 'A';
INSERT INTO timetable (class_level, class_arm, weekday, starts_at, ends_at, subject_id, teacher, room)
SELECT 'SS2', 'A', d.weekday, t.starts_at, t.ends_at, s.id, t.teacher, t.room
FROM (VALUES
  ('Mathematics',      TIME '08:00', TIME '09:00', 'Mr. Okafor',   'Room 12'),
  ('English Language', TIME '09:00', TIME '10:00', 'Mrs. Bello',   'Room 8'),
  ('Biology',          TIME '10:30', TIME '11:30', 'Mr. Okoro',    'Lab 1'),
  ('Computer Studies', TIME '12:00', TIME '13:00', 'Mrs. Ibrahim', 'ICT 2'),
  ('Physics',          TIME '14:00', TIME '15:00', 'Mr. Adeyemi',  'Lab 2')
) AS t(subject, starts_at, ends_at, teacher, room)
JOIN subjects s ON s.name = t.subject
CROSS JOIN (VALUES (1),(2),(3),(4),(5)) AS d(weekday);

-- --- Assignments ----------------------------------------------------------
DELETE FROM assignments WHERE class_level = 'SS2' AND class_arm = 'A';
INSERT INTO assignments (class_level, class_arm, subject_id, title, brief, due_on)
SELECT 'SS2', 'A', s.id, a.title, a.brief, a.due_on
FROM (VALUES
  ('Mathematics',      'Mathematics Homework', 'Solve exercises 1 - 10 in the textbook.',                 current_date + 3),
  ('English Language', 'English Essay',        'Write a 500-word essay on "The Importance of Education".', current_date + 4),
  ('Biology',          'Biology Project',      'Research on cell division and present a report.',          current_date + 6),
  ('Computer Studies', 'ICT Practical',        'Create a simple website using HTML & CSS.',                current_date + 8)
) AS a(subject, title, brief, due_on)
JOIN subjects s ON s.name = a.subject;

-- Daniel has handed in the maths homework only.
INSERT INTO assignment_submissions (assignment_id, register_id)
SELECT a.id, r.id
FROM assignments a
JOIN register r ON upper(replace(r.admission_no,' ','')) = 'BFS/2024/0178'
WHERE a.title = 'Mathematics Homework'
ON CONFLICT DO NOTHING;

-- --- Results --------------------------------------------------------------
INSERT INTO subject_results (register_id, subject_id, session, term, score)
SELECT r.id, s.id, '2024/2025', 2, v.score
FROM (VALUES
  ('Mathematics', 88), ('English Language', 80), ('Biology', 85),
  ('Computer Studies', 78), ('Physics', 83)
) AS v(subject, score)
JOIN subjects s ON s.name = v.subject
JOIN register r ON upper(replace(r.admission_no,' ','')) = 'BFS/2024/0178'
ON CONFLICT (register_id, subject_id, session, term) DO UPDATE SET score = EXCLUDED.score;

-- --- Attendance: 46 present, 2 absent, 1 late -----------------------------
DELETE FROM attendance
 WHERE register_id = (SELECT id FROM register WHERE upper(replace(admission_no,' ','')) = 'BFS/2024/0178');
INSERT INTO attendance (register_id, on_date, state)
SELECT r.id,
       d.day,
       CASE WHEN row_number() OVER (ORDER BY d.day) IN (12, 27) THEN 'absent'
            WHEN row_number() OVER (ORDER BY d.day) = 34        THEN 'late'
            ELSE 'present' END
FROM register r
CROSS JOIN LATERAL (
  -- The last 49 weekdays.
  SELECT day::date AS day
    FROM generate_series(current_date - 90, current_date, interval '1 day') AS day
   WHERE extract(isodow FROM day) BETWEEN 1 AND 5
   ORDER BY day DESC
   LIMIT 49
) AS d
WHERE upper(replace(r.admission_no,' ','')) = 'BFS/2024/0178';

-- --- Announcements --------------------------------------------------------
DELETE FROM announcements;
INSERT INTO announcements (title, body, published_on, audience) VALUES
  ('Inter-house Sports Competition',
   'The annual inter-house sports competition will hold next month. Houses should begin practice with their sports prefects.',
   current_date - 4, 'all'),
  ('ICT Lab Upgrade',
   'The ICT lab has been upgraded with new computers and modern software for coding and CBT practice.',
   current_date - 7, 'all'),
  ('School Fees Reminder',
   'Kindly pay your term fees before the end of the month. Speak to the bursary about instalment plans.',
   current_date - 10, 'all'),
  ('Second Term Examinations',
   'End of term examinations begin in the final two weeks of term. Timetables will be posted on the notice board.',
   current_date - 14, 'students');

-- --- Messages: three unread, matching the badge in the design -------------
DELETE FROM messages WHERE user_id IN (
  SELECT u.id FROM users u JOIN register r ON r.id = u.register_id
   WHERE upper(replace(r.admission_no,' ','')) = 'BFS/2024/0178');
INSERT INTO messages (user_id, sender, subject, body, sent_at, read_at)
SELECT u.id, v.sender, v.subject, v.body, now() - (v.hours || ' hours')::interval, NULL
FROM users u
JOIN register r ON r.id = u.register_id
CROSS JOIN (VALUES
  ('Mr. Okafor',   'Well done on your last test', 'Your work on quadratic equations has improved a great deal. Keep it up.', 5),
  ('Mrs. Bello',   'Essay title confirmed',       'Please use the title exactly as given. Hand-written submissions are fine.', 26),
  ('School Office','Fees reminder',               'Kindly pay your term fees before the end of the month.', 50)
) AS v(sender, subject, body, hours)
WHERE upper(replace(r.admission_no,' ','')) = 'BFS/2024/0178';
