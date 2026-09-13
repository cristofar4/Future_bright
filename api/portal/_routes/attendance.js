/* GET /api/portal/attendance - the pupil's attendance totals and recent days. */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { requireStudent, studentSummary, currentTerm, unreadCount, portalRoute } from "../_student.js";

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const ctx = await requireStudent(req, res);
  if (!ctx) return;

  const { rows: totals } = await query(
    `SELECT count(*) FILTER (WHERE state = 'present')::int AS present,
            count(*) FILTER (WHERE state = 'absent')::int  AS absent,
            count(*) FILTER (WHERE state = 'late')::int    AS late,
            count(*)::int                                  AS total
       FROM attendance WHERE register_id = $1`,
    [ctx.student.id]
  );
  const { rows: records } = await query(
    `SELECT on_date, state FROM attendance
      WHERE register_id = $1 ORDER BY on_date DESC LIMIT 30`,
    [ctx.student.id]
  );

  const summary = totals[0] || { present: 0, absent: 0, late: 0, total: 0 };
  summary.percent = summary.total ? Math.round((summary.present / summary.total) * 100) : null;

  return json(res, 200, {
    student: studentSummary(ctx.session, ctx.student),
    term: await currentTerm(),
    unreadMessages: await unreadCount(ctx.session.id),
    summary,
    records,
  });
});
