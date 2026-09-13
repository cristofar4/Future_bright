/* GET /api/portal/admin - a school-wide overview, for administrators only.
 *
 * The only view that reads across pupils, so it is gated on users.is_admin
 * rather than on a role. Nothing here exposes a password hash or a session.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { currentTerm, unreadCount, portalRoute, homeFor, firstNameOf, initialsOf } from "../_student.js";

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const session = await getSessionUser(req);
  if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
  if (!session.is_admin) {
    return json(res, 403, {
      error: "not_admin",
      message: "This page is for administrators. The first account created on a new site is the administrator.",
      home: homeFor(session),
    });
  }

  const [totals, byClass, recent, notes, sources] = await Promise.all([
    query(
      `SELECT (SELECT count(*)::int FROM register WHERE status = 'active')        AS pupils,
              (SELECT count(*)::int FROM register WHERE status = 'left')          AS left_pupils,
              (SELECT count(*)::int FROM staff_register WHERE status = 'active')  AS staff,
              (SELECT count(*)::int FROM users)                                   AS accounts,
              (SELECT count(*)::int FROM users WHERE role = 'student')            AS student_accounts,
              (SELECT count(*)::int FROM users WHERE role = 'parent')             AS parent_accounts,
              (SELECT count(*)::int FROM users WHERE role = 'teacher')            AS teacher_accounts,
              (SELECT count(*)::int FROM timetable)                               AS lessons,
              (SELECT count(*)::int FROM assignments)                             AS assignments,
              (SELECT count(*)::int FROM announcements)                           AS announcements,
              (SELECT count(*)::int FROM sessions WHERE expires_at > now())        AS active_sessions`
    ),
    query(
      `SELECT (class_level || class_arm) AS class_name, count(*)::int AS pupils
         FROM register WHERE status = 'active'
        GROUP BY class_level, class_arm ORDER BY class_name`
    ),
    // Names and roles only: never a hash, never a session token.
    query(
      `SELECT u.full_name, u.role, u.email, u.created_at, u.is_admin
         FROM users u ORDER BY u.created_at DESC LIMIT 8`
    ),
    query(
      `SELECT id, title, body, published_on, audience
         FROM announcements ORDER BY published_on DESC LIMIT 5`
    ),
    query(
      `SELECT source, count(*)::int AS n FROM register
        WHERE status = 'active' GROUP BY source ORDER BY source`
    ),
  ]);

  const flag = String(process.env.PORTAL_OPEN_SIGNUP || "").toLowerCase();
  const imported = (sources.rows.find((r) => r.source === "import") || { n: 0 }).n;
  const openSignup = flag === "true" || flag === "1" ? true
                   : flag === "false" || flag === "0" ? false : imported === 0;

  return json(res, 200, {
    admin: {
      isAdmin: true,
      fullName: session.full_name,
      firstName: firstNameOf(session.full_name),
      initials: initialsOf(session.full_name),
      email: session.email,
      role: session.role,
    },
    term: await currentTerm(),
    unreadMessages: await unreadCount(session.id),
    totals: totals.rows[0],
    byClass: byClass.rows,
    recentAccounts: recent.rows,
    announcements: notes.rows,
    register: {
      sources: sources.rows,
      imported,
      openSignup,
      override: flag || null,
    },
  });
});
