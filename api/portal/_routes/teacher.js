/* GET /api/portal/teacher - the signed-in teacher's day, classes and pupils.
 *
 * Lessons are matched on the teacher name recorded against the timetable, so a
 * teacher sees their own periods rather than the whole school's.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { currentTerm, unreadCount, portalRoute, homeFor, firstNameOf, initialsOf } from "../_student.js";

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const session = await getSessionUser(req);
  if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
  if (session.role !== "teacher") {
    return json(res, 403, {
      error: "wrong_portal",
      message: "This page is for teaching staff. Your own dashboard is a click away.",
      home: homeFor(session),
    });
  }

  const { rows: staff } = await query(
    `SELECT s.id, s.staff_no, s.surname, s.other_names
       FROM staff_register s JOIN users u ON u.staff_id = s.id
      WHERE u.id = $1`,
    [session.id]
  );
  if (!staff.length) {
    return json(res, 404, { error: "no_record", message: "No staff record is linked to this account." });
  }
  const me = staff[0];

  // The timetable records a display name such as "Mr. Okafor". Match on the
  // surname so a teacher finds their own lessons without an extra join table.
  const surnamePattern = `%${me.surname}%`;
  const isoDay = new Date().getDay();
  const weekday = isoDay >= 1 && isoDay <= 5 ? isoDay : 1;

  const [today, week, classes, notes, counts] = await Promise.all([
    query(
      `SELECT to_char(t.starts_at, 'HH12:MI AM') AS starts_at,
              to_char(t.ends_at,   'HH12:MI AM') AS ends_at,
              to_char(t.starts_at, 'HH24:MI')    AS starts_at_24,
              s.name AS subject, s.accent, s.icon, t.teacher, t.room,
              (t.class_level || t.class_arm) AS class_name
         FROM timetable t JOIN subjects s ON s.id = t.subject_id
        WHERE t.teacher ILIKE $1 AND t.weekday = $2
        ORDER BY t.starts_at`,
      [surnamePattern, weekday]
    ),
    query(
      `SELECT count(*)::int AS n FROM timetable WHERE teacher ILIKE $1`,
      [surnamePattern]
    ),
    query(
      `SELECT DISTINCT (t.class_level || t.class_arm) AS class_name,
              t.class_level, t.class_arm,
              (SELECT count(*)::int FROM register r
                WHERE r.class_level = t.class_level AND r.class_arm = t.class_arm
                  AND r.status = 'active') AS pupils,
              (SELECT string_agg(DISTINCT s2.name, ', ' ORDER BY s2.name)
                 FROM timetable t2 JOIN subjects s2 ON s2.id = t2.subject_id
                WHERE t2.teacher ILIKE $1
                  AND t2.class_level = t.class_level AND t2.class_arm = t.class_arm) AS subjects
         FROM timetable t
        WHERE t.teacher ILIKE $1
        ORDER BY class_name`,
      [surnamePattern]
    ),
    query(
      `SELECT id, title, body, published_on FROM announcements
        WHERE audience IN ('all', 'staff') ORDER BY published_on DESC LIMIT 4`
    ),
    query(
      `SELECT (SELECT count(DISTINCT s.name)::int
                 FROM timetable t JOIN subjects s ON s.id = t.subject_id
                WHERE t.teacher ILIKE $1) AS subjects,
              (SELECT count(*)::int FROM register r WHERE r.status = 'active') AS pupils_total`,
      [surnamePattern]
    ),
  ]);

  const pupils = classes.rows.reduce((n, c) => n + (c.pupils || 0), 0);

  return json(res, 200, {
    teacher: {
      isAdmin: Boolean(session.is_admin),
      fullName: session.full_name,
      firstName: firstNameOf(me.other_names || session.full_name),
      initials: initialsOf(session.full_name),
      staffNo: me.staff_no,
      email: session.email,
    },
    term: await currentTerm(),
    unreadMessages: await unreadCount(session.id),
    today: today.rows,
    classes: classes.rows,
    announcements: notes.rows,
    totals: {
      lessonsPerWeek: week.rows[0] ? week.rows[0].n : 0,
      classes: classes.rows.length,
      pupils,
      subjects: counts.rows[0] ? counts.rows[0].subjects : 0,
    },
  });
});
