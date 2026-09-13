-- Demo register rows, for trying the portal before the real spreadsheet is
-- imported. Do NOT load this into production.
INSERT INTO register (admission_no, surname, other_names, class_level, guardian_email, guardian_phone, status, source) VALUES
  ('BFS/2025/0142', 'Okafor',  'Chidera Ada',   'SS2',  'amaka.okafor@example.com', '+234 802 111 2233', 'active', 'demo'),
  ('BFS/2025/0187', 'Bello',   'Ibrahim Musa',  'JSS2', 'amina.bello@example.com',  '08033445566',       'active', 'demo'),
  ('BFS/2024/0091', 'Adeyemi', 'Tunde Samuel',  'SS3',  NULL,                        '+234 805 777 8899', 'active', 'demo'),
  ('BFS/2019/0007', 'Eze',     'Ngozi Grace',   'SS3',  'ngozi.eze@example.com',     NULL,                'left', 'demo')
ON CONFLICT (upper(replace(admission_no, ' ', ''))) DO NOTHING;

INSERT INTO staff_register (staff_no, surname, other_names, email, status, source) VALUES
  ('BFS/STF/014', 'Ogun',    'Folake',  'folake.ogun@brightfuture.edu.ng', 'active', 'demo'),
  ('BFS/STF/022', 'Ibrahim', 'Samuel',  NULL,                              'active', 'demo')
ON CONFLICT (upper(replace(staff_no, ' ', ''))) DO NOTHING;
