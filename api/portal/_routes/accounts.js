/* GET    /api/portal/accounts        - every portal account
 * POST   /api/portal/accounts        - {id, action} : sign out, or make/unmake an admin
 * DELETE /api/portal/accounts?id=N   - take an account away
 *
 * The page that can lock somebody out, so the rules matter more than the page:
 *
 *   - you cannot change your own administrator flag, or delete your own
 *     account, because an accident there costs you the way back in;
 *   - the last administrator cannot be removed or demoted, or the school is
 *     left with no way into this page at all except the database itself.
 *
 * The second rule cannot fire while the first one stands: only an
 * administrator reaches this page, so if there is just one of them, the only
 * person they could be removing is themselves, which the first rule already
 * refuses. It stays because it is the rule that actually matters - relax the
 * first one later and this is what still stops the school locking itself out.
 *
 * Removing an account never touches the school record behind it. The pupil
 * stays on the register and can sign up again; only the way in is withdrawn.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed, readJson, badBody } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { currentTerm, unreadCount, portalRoute, homeFor, firstNameOf, initialsOf } from "../_student.js";

const PER_PAGE = 25;

function identity(session) {
  return {
    isAdmin: true,
    id: String(session.id),
    fullName: session.full_name,
    firstName: firstNameOf(session.full_name),
    initials: initialsOf(session.full_name),
    email: session.email,
    role: session.role,
  };
}

/** Names, roles and sign-in times. Never a hash, never a session token. */
const SELECT_ACCOUNTS = `
  SELECT u.id, u.role, u.full_name, u.email, u.phone, u.is_admin,
         u.created_at, u.last_login_at,
         (SELECT count(*)::int FROM sessions s
           WHERE s.user_id = u.id AND s.expires_at > now()) AS sessions,
         r.admission_no,
         (r.class_level || coalesce(nullif(r.class_arm,''),'A')) AS class_name,
         st.staff_no
    FROM users u
    LEFT JOIN register r        ON r.id  = u.register_id
    LEFT JOIN staff_register st ON st.id = u.staff_id`;

function shape(row) {
  const name = String(row.full_name || "");
  return {
    id: String(row.id),
    role: row.role,
    isAdmin: row.is_admin,
    fullName: name,
    initials: initialsOf(name),
    email: row.email,
    phone: row.phone,
    joinedOn: row.created_at,
    lastLogin: row.last_login_at,
    sessions: row.sessions,
    linkedTo: row.admission_no
      ? row.admission_no + (row.class_name ? "  ·  " + row.class_name : "")
      : row.staff_no || null,
  };
}

async function countAdmins() {
  const { rows } = await query(`SELECT count(*)::int AS n FROM users WHERE is_admin`);
  return rows[0].n;
}

export default portalRoute(async function (req, res) {
  const method = req.method;
  if (!["GET", "POST", "DELETE"].includes(method)) {
    return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
  }

  const session = await getSessionUser(req);
  if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
  if (!session.is_admin) {
    return json(res, 403, {
      error: "not_admin",
      message: "Portal accounts are for administrators. Your own dashboard is a click away.",
      home: homeFor(session),
    });
  }

  const url = new URL(req.url, "http://localhost");

  async function list(extra) {
    const q = String(url.searchParams.get("q") || "").trim().slice(0, 60);
    const role = ["student", "parent", "teacher", "admin"]
      .includes(url.searchParams.get("role")) ? url.searchParams.get("role") : "";
    const page = Math.max(1, Math.min(400, Number(url.searchParams.get("page")) || 1));

    const where = [];
    const args = [];
    if (role === "admin") { where.push("u.is_admin"); }
    else if (role) { args.push(role); where.push(`u.role = $${args.length}`); }
    if (q) {
      args.push(`%${q}%`);
      where.push(`(u.full_name ILIKE $${args.length} OR u.email ILIKE $${args.length})`);
    }
    const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [count, rows, totals] = await Promise.all([
      query(`SELECT count(*)::int AS n FROM users u ${filter}`, args),
      query(`${SELECT_ACCOUNTS} ${filter} ORDER BY u.created_at DESC
             LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`, args),
      query(
        `SELECT count(*)::int AS accounts,
                count(*) FILTER (WHERE role = 'student')::int AS students,
                count(*) FILTER (WHERE role = 'parent')::int  AS parents,
                count(*) FILTER (WHERE role = 'teacher')::int AS teachers,
                count(*) FILTER (WHERE is_admin)::int         AS admins,
                (SELECT count(DISTINCT user_id)::int FROM sessions
                  WHERE expires_at > now())                   AS signed_in
           FROM users`
      ),
    ]);

    const total = count.rows[0].n;
    return json(res, 200, {
      admin: identity(session),
      term: await currentTerm(),
      unreadMessages: await unreadCount(session.id),
      accounts: rows.rows.map(shape),
      totals: totals.rows[0],
      page,
      pages: Math.max(1, Math.ceil(total / PER_PAGE)),
      perPage: PER_PAGE,
      total,
      filters: { q, role: role || "all" },
      ...extra,
    });
  }

  if (method === "GET") return list();

  /* -------------------------------------------------------------- changes */
  async function target(id) {
    if (!Number.isInteger(id) || id <= 0) return { bad: "Which account?" };
    if (String(id) === String(session.id)) {
      return { bad: "That is your own account. Ask another administrator to do it." };
    }
    const { rows } = await query(`SELECT id, full_name, is_admin FROM users WHERE id = $1`, [id]);
    if (!rows.length) return { bad: "There is no account with that id." };
    return { user: rows[0] };
  }

  if (method === "DELETE") {
    const found = await target(Number(url.searchParams.get("id")));
    if (found.bad) return json(res, found.bad.startsWith("There is no") ? 404 : 400,
      { error: "refused", message: found.bad });

    if (found.user.is_admin && (await countAdmins()) <= 1) {
      return json(res, 409, {
        error: "last_admin",
        message: "That is the only administrator. Make somebody else one first.",
      });
    }
    // Sessions and messages hang off the account and go with it. The school
    // record does not: the register keeps the pupil, and they can sign up again.
    await query(`DELETE FROM users WHERE id = $1`, [found.user.id]);
    return list({
      ok: true,
      message: `${found.user.full_name} no longer has a way in. Their school record is untouched.`,
    });
  }

  let body;
  try { body = await readJson(req); } catch (err) { return badBody(req, res, err); }

  const action = typeof body.action === "string" ? body.action : "";
  const found = await target(Number(body.id));
  if (found.bad) return json(res, found.bad.startsWith("There is no") ? 404 : 400,
    { error: "refused", message: found.bad });

  if (action === "signout") {
    const { rowCount } = await query(`DELETE FROM sessions WHERE user_id = $1`, [found.user.id]);
    return list({
      ok: true,
      message: rowCount
        ? `${found.user.full_name} has been signed out everywhere.`
        : `${found.user.full_name} was not signed in anywhere.`,
    });
  }

  if (action === "admin") {
    const on = body.on === true;
    if (!on && found.user.is_admin && (await countAdmins()) <= 1) {
      return json(res, 409, {
        error: "last_admin",
        message: "That is the only administrator. Make somebody else one first.",
      });
    }
    await query(`UPDATE users SET is_admin = $1 WHERE id = $2`, [on, found.user.id]);
    return list({
      ok: true,
      message: on
        ? `${found.user.full_name} is now an administrator.`
        : `${found.user.full_name} is no longer an administrator.`,
    });
  }

  return json(res, 400, { error: "bad_action", message: "That is not something this page does." });
});
