/* GET /api/portal/results - subject scores for the pupil, by term. */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { requireStudent, studentSummary, currentTerm, unreadCount, portalRoute } from "../_student.js";

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const ctx = await requireStudent(req, res);
  if (!ctx) return;

  const { rows } = await query(
    `SELECT s.name AS subject, s.accent, sr.score::float AS score, sr.session, sr.term
       FROM subject_results sr
       JOIN subjects s ON s.id = sr.subject_id
      WHERE sr.register_id = $1
      ORDER BY sr.session DESC, sr.term DESC, sr.score DESC`,
    [ctx.student.id]
  );

  const average = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length)
    : null;

  return json(res, 200, {
    student: studentSummary(ctx.session, ctx.student),
    term: await currentTerm(),
    unreadMessages: await unreadCount(ctx.session.id),
    results: rows,
    average,
    best: rows.length ? rows.reduce((a, b) => (a.score >= b.score ? a : b)).subject : null,
  });
});
