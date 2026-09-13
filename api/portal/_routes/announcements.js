/* GET    /api/portal/announcements        - the notice board, as an admin sees it
 * POST   /api/portal/announcements        - post a notice
 * PATCH  /api/portal/announcements        - change one, by id in the body
 * DELETE /api/portal/announcements?id=N   - take one down
 *
 * The first thing in the portal that writes. Administrators only, on
 * users.is_admin.
 *
 * There is no CSRF token because there is nothing for one to add here: the
 * session cookie is SameSite=Lax, so it is not sent on a cross-site POST at
 * all, and the body must be JSON, which a plain cross-site form cannot send.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed, readJson, badBody } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { currentTerm, unreadCount, portalRoute, homeFor, firstNameOf, initialsOf } from "../_student.js";

const AUDIENCES = ["all", "students", "parents", "staff"];
const TITLE_MAX = 120;
const BODY_MAX = 4000;

function identity(session) {
  return {
    isAdmin: true,
    fullName: session.full_name,
    firstName: firstNameOf(session.full_name),
    initials: initialsOf(session.full_name),
    email: session.email,
    role: session.role,
  };
}

/** Returns { ok: true, value } or { ok: false, field, message }. */
function checkNotice(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const audience = typeof body.audience === "string" ? body.audience.trim() : "all";
  const on = typeof body.publishedOn === "string" ? body.publishedOn.trim() : "";

  if (title.length < 3) {
    return { ok: false, field: "title", message: "Give the notice a title of at least 3 characters." };
  }
  if (title.length > TITLE_MAX) {
    return { ok: false, field: "title", message: `Titles are at most ${TITLE_MAX} characters.` };
  }
  if (text.length < 3) {
    return { ok: false, field: "body", message: "Write the notice itself before posting it." };
  }
  if (text.length > BODY_MAX) {
    return { ok: false, field: "body", message: `Notices are at most ${BODY_MAX} characters.` };
  }
  if (!AUDIENCES.includes(audience)) {
    return { ok: false, field: "audience", message: "Choose who the notice is for." };
  }

  let publishedOn = null;
  if (on) {
    // Exactly YYYY-MM-DD, and a date that really exists: Postgres would take
    // 2026-02-31 and shift it, which is not what anybody meant.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) {
      return { ok: false, field: "publishedOn", message: "Use a date like 2026-09-13." };
    }
    const d = new Date(on + "T00:00:00Z");
    if (isNaN(d) || d.toISOString().slice(0, 10) !== on) {
      return { ok: false, field: "publishedOn", message: "That date does not exist." };
    }
    publishedOn = on;
  }

  return { ok: true, value: { title, body: text, audience, publishedOn } };
}

const SELECT_ONE = `
  SELECT a.id, a.title, a.body, a.published_on, a.audience, a.created_at, a.updated_at,
         a.author, (a.published_on > current_date) AS scheduled
    FROM announcements a`;

export default portalRoute(async function (req, res) {
  const method = req.method;
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
    return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
  }

  const session = await getSessionUser(req);
  if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
  if (!session.is_admin) {
    return json(res, 403, {
      error: "not_admin",
      message: "Announcements are written by administrators. Your own dashboard is a click away.",
      home: homeFor(session),
    });
  }

  /* ------------------------------------------------------------ the board */
  async function board(extra) {
    const [rows, counts] = await Promise.all([
      query(`${SELECT_ONE} ORDER BY a.published_on DESC, a.id DESC LIMIT 100`),
      query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE published_on > current_date)::int AS scheduled,
                count(*) FILTER (WHERE audience = 'all')::int            AS everyone
           FROM announcements`
      ),
    ]);
    return json(res, 200, {
      admin: identity(session),
      term: await currentTerm(),
      unreadMessages: await unreadCount(session.id),
      announcements: rows.rows,
      totals: counts.rows[0],
      audiences: AUDIENCES,
      limits: { title: TITLE_MAX, body: BODY_MAX },
      ...extra,
    });
  }

  if (method === "GET") return board();

  /* ---------------------------------------------------------------- write */
  if (method === "DELETE") {
    const id = Number(new URL(req.url, "http://localhost").searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return json(res, 400, { error: "bad_id", message: "Which notice?" });
    }
    const { rows } = await query(`DELETE FROM announcements WHERE id = $1 RETURNING title`, [id]);
    if (!rows.length) {
      return json(res, 404, { error: "no_notice", message: "That notice is not on the board." });
    }
    return board({ ok: true, message: `"${rows[0].title}" has been taken down.` });
  }

  let body;
  try { body = await readJson(req); } catch (err) { return badBody(req, res, err); }

  const checked = checkNotice(body);
  if (!checked.ok) {
    return json(res, 400, { error: "invalid", field: checked.field, message: checked.message });
  }
  const v = checked.value;

  if (method === "POST") {
    const { rows } = await query(
      `INSERT INTO announcements (title, body, audience, published_on, author)
       VALUES ($1, $2, $3, coalesce($4::date, current_date), $5)
       RETURNING id, (published_on > current_date) AS scheduled`,
      [v.title, v.body, v.audience, v.publishedOn, session.full_name]
    );
    const posted = rows[0];
    return board({
      ok: true,
      id: String(posted.id),
      message: posted.scheduled
        ? "Saved. It goes on the board on the date you chose."
        : "Posted. It is on the board now.",
    });
  }

  // PATCH
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return json(res, 400, { error: "bad_id", message: "Which notice?" });
  }
  const { rows } = await query(
    `UPDATE announcements
        SET title = $1, body = $2, audience = $3,
            published_on = coalesce($4::date, published_on),
            updated_at = now()
      WHERE id = $5
      RETURNING id`,
    [v.title, v.body, v.audience, v.publishedOn, id]
  );
  if (!rows.length) {
    return json(res, 404, { error: "no_notice", message: "That notice is not on the board." });
  }
  return board({ ok: true, id: String(id), message: "Your changes have been saved." });
});
