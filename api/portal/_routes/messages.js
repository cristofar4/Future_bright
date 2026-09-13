/* GET  /api/portal/messages          - the pupil's messages
 * POST /api/portal/messages  {id}    - mark one as read
 *
 * Both are scoped to the signed-in user, so passing someone else's message id
 * simply matches no row.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed, readJson, badBody } from "../../_lib/http.js";
import { requireStudent, studentSummary, currentTerm, unreadCount, portalRoute } from "../_student.js";

export default portalRoute(async function (req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  const ctx = await requireStudent(req, res);
  if (!ctx) return;

  if (req.method === "POST") {
    let body;
    try { body = await readJson(req); } catch (err) { return badBody(req, res, err); }

    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return json(res, 400, { error: "bad_id", message: "Which message?" });
    }
    // The user_id condition is what stops one pupil marking another's mail.
    const { rowCount } = await query(
      `UPDATE messages SET read_at = now()
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [id, ctx.session.id]
    );
    return json(res, 200, { ok: true, changed: rowCount, unread: await unreadCount(ctx.session.id) });
  }

  const { rows } = await query(
    `SELECT id, sender, subject, body, sent_at, (read_at IS NOT NULL) AS read
       FROM messages WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 50`,
    [ctx.session.id]
  );

  return json(res, 200, {
    student: studentSummary(ctx.session, ctx.student),
    term: await currentTerm(),
    messages: rows,
    unread: rows.filter((m) => !m.read).length,
    unreadMessages: rows.filter((m) => !m.read).length,
  });
});
