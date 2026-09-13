/* GET /api/portal/parent - the child's record, for the signed-in parent.
 *
 * Keyed on the register row their account is linked to, so a parent can only
 * ever see the child the school attached them to.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { currentTerm, unreadCount, portalRoute, homeFor, firstNameOf, initialsOf } from "../_student.js";

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const session = await getSessionUser(req);
  if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
  if (session.role !== "parent") {
    return json(res, 403, {
      error: "wrong_portal",
      message: "This page is for parents and guardians. Your own dashboard is a click away.",
      home: homeFor(session),
    });
  }

  const { rows: kids } = await query(
    `SELECT r.id, r.admission_no, r.surname, r.other_names, r.class_level, r.class_arm
       FROM register r JOIN users u ON u.register_id = r.id
      WHERE u.id = $1`,
    [session.id]
  );
  if (!kids.length) {
    return json(res, 404, { error: "no_child", message: "No pupil is linked to this account." });
  }
  const child = kids[0];
  const childName = [child.other_names, child.surname].filter(Boolean).join(" ").trim();

  const isoDay = new Date().getDay();
  const weekday = isoDay >= 1 && isoDay <= 5 ? isoDay : 1;

  const [today, results, att, tasks, notes] = await Promise.all([
    query(
      `SELECT to_char(t.starts_at, 'HH12:MI AM') AS starts_at,
              to_char(t.ends_at,   'HH12:MI AM') AS ends_at,
              to_char(t.starts_at, 'HH24:MI')    AS starts_at_24,
              s.name AS subject, s.accent, s.icon, t.teacher, t.room
         FROM timetable t JOIN subjects s ON s.id = t.subject_id
        WHERE t.class_level = $1 AND t.class_arm = $2 AND t.weekday = $3
        ORDER BY t.starts_at`,
      [child.class_level, child.class_arm, weekday]
    ),
    query(
      `SELECT s.name AS subject, sr.score::float AS score
         FROM subject_results sr JOIN subjects s ON s.id = sr.subject_id
        WHERE sr.register_id = $1 ORDER BY sr.score DESC`,
      [child.id]
    ),
    query(
      `SELECT count(*) FILTER (WHERE state = 'present')::int AS present,
              count(*) FILTER (WHERE state = 'absent')::int  AS absent,
              count(*) FILTER (WHERE state = 'late')::int    AS late,
              count(*)::int                                  AS total
         FROM attendance WHERE register_id = $1`,
      [child.id]
    ),
    query(
      `SELECT a.title, a.due_on, s.name AS subject,
              (sub.assignment_id IS NOT NULL) AS submitted
         FROM assignments a
         JOIN subjects s ON s.id = a.subject_id
         LEFT JOIN assignment_submissions sub
                ON sub.assignment_id = a.id AND sub.register_id = $3
        WHERE a.class_level = $1 AND a.class_arm = $2
        ORDER BY a.due_on LIMIT 6`,
      [child.class_level, child.class_arm, child.id]
    ),
    query(
      `SELECT id, title, body, published_on FROM announcements
        WHERE audience IN ('all', 'parents') AND published_on <= current_date
        ORDER BY published_on DESC LIMIT 4`
    ),
  ]);

  const attendance = att.rows[0] || { present: 0, absent: 0, late: 0, total: 0 };
  attendance.percent = attendance.total
    ? Math.round((attendance.present / attendance.total) * 100) : null;

  const average = results.rows.length
    ? Math.round(results.rows.reduce((n, r) => n + r.score, 0) / results.rows.length) : null;

  return json(res, 200, {
    parent: {
      isAdmin: Boolean(session.is_admin),
      fullName: session.full_name,
      firstName: firstNameOf(session.full_name),
      initials: initialsOf(session.full_name),
      email: session.email,
      phone: session.phone,
    },
    child: {
      fullName: childName,
      firstName: firstNameOf(child.other_names || childName),
      initials: initialsOf(childName),
      admissionNo: child.admission_no,
      className: child.class_level + (child.class_arm || ""),
    },
    term: await currentTerm(),
    unreadMessages: await unreadCount(session.id),
    today: today.rows,
    results: results.rows,
    average,
    attendance,
    assignments: tasks.rows,
    announcements: notes.rows,
    outstanding: tasks.rows.filter((t) => !t.submitted).length,
  });
});
