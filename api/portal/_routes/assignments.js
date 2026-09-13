/* GET /api/portal/assignments - every assignment set for the pupil's class. */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { requireStudent, studentSummary, currentTerm, unreadCount, portalRoute } from "../_student.js";

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const ctx = await requireStudent(req, res);
  if (!ctx) return;

  const { rows } = await query(
    `SELECT a.id, a.title, a.brief, a.due_on, s.name AS subject, s.accent,
            (sub.assignment_id IS NOT NULL) AS submitted,
            sub.submitted_at, sub.score::float AS score
       FROM assignments a
       JOIN subjects s ON s.id = a.subject_id
       LEFT JOIN assignment_submissions sub
              ON sub.assignment_id = a.id AND sub.register_id = $3
      WHERE a.class_level = $1 AND a.class_arm = $2
      ORDER BY a.due_on DESC`,
    [ctx.student.class_level, ctx.student.class_arm, ctx.student.id]
  );

  return json(res, 200, {
    student: studentSummary(ctx.session, ctx.student),
    term: await currentTerm(),
    unreadMessages: await unreadCount(ctx.session.id),
    assignments: rows,
  });
});
