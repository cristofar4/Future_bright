/* GET /api/portal/classes - the full week's timetable for the pupil's class. */
import { query } from "../_lib/db.js";
import { json, methodNotAllowed } from "../_lib/http.js";
import { requireStudent, studentSummary, currentTerm, unreadCount, portalRoute } from "./_student.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const ctx = await requireStudent(req, res);
  if (!ctx) return;

  const { rows } = await query(
    `SELECT t.weekday,
            to_char(t.starts_at, 'HH12:MI AM') AS starts_at,
            to_char(t.ends_at,   'HH12:MI AM') AS ends_at,
            to_char(t.starts_at, 'HH24:MI')    AS starts_at_24,
            s.name AS subject, s.accent, s.icon, t.teacher, t.room
       FROM timetable t
       JOIN subjects s ON s.id = t.subject_id
      WHERE t.class_level = $1 AND t.class_arm = $2
      ORDER BY t.weekday, t.starts_at`,
    [ctx.student.class_level, ctx.student.class_arm]
  );

  const week = DAYS.map((name, i) => ({
    weekday: i + 1,
    name,
    lessons: rows.filter((r) => r.weekday === i + 1),
  }));

  const isoDay = new Date().getDay();
  return json(res, 200, {
    student: studentSummary(ctx.session, ctx.student),
    term: await currentTerm(),
    unreadMessages: await unreadCount(ctx.session.id),
    week,
    today: isoDay >= 1 && isoDay <= 5 ? isoDay : 1,
  });
});
