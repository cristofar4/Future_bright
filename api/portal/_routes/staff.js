/* GET /api/portal/staff        - the staff register, searchable
 * GET /api/portal/staff?id=N   - one member of staff, and what they teach
 *
 * Administrators only, on users.is_admin. Returns no password hash and no
 * session token, the same as every other view that reads across people.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { currentTerm, unreadCount, portalRoute, homeFor, firstNameOf, initialsOf } from "../_student.js";

const PER_PAGE = 25;

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

function staffShape(row) {
  const name = [row.other_names, row.surname].filter(Boolean).join(" ").trim();
  return {
    id: String(row.id),
    staffNo: row.staff_no,
    fullName: name,
    surname: row.surname,
    otherNames: row.other_names,
    initials: initialsOf(name),
    email: row.email,
    status: row.status,
    source: row.source,
    joinedOn: row.created_at,
    accounts: row.accounts,
    periods: row.periods,
    subjects: row.subjects,
  };
}

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const session = await getSessionUser(req);
  if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
  if (!session.is_admin) {
    return json(res, 403, {
      error: "not_admin",
      message: "The staff list is for administrators. Your own dashboard is a click away.",
      home: homeFor(session),
    });
  }

  /* The timetable records a display name such as "Mrs. Ibrahim", so periods are
     matched on surname, the same way the teacher dashboard finds its own. */
  const WITH_TEACHING = `
    (SELECT count(*)::int FROM timetable t WHERE t.teacher ILIKE '%' || s.surname || '%') AS periods,
    (SELECT string_agg(DISTINCT sub.name, ', ' ORDER BY sub.name)
       FROM timetable t JOIN subjects sub ON sub.id = t.subject_id
      WHERE t.teacher ILIKE '%' || s.surname || '%') AS subjects,
    (SELECT count(*)::int FROM users u WHERE u.staff_id = s.id) AS accounts`;

  const url = new URL(req.url, "http://localhost");
  const wanted = url.searchParams.get("id");

  /* ------------------------------------------------- one member of staff */
  if (wanted !== null) {
    const id = Number(wanted);
    if (!Number.isInteger(id) || id <= 0) {
      return json(res, 400, { error: "bad_id", message: "Which member of staff?" });
    }

    const { rows } = await query(`SELECT s.*, ${WITH_TEACHING} FROM staff_register s WHERE s.id = $1`, [id]);
    if (!rows.length) {
      return json(res, 404, { error: "no_staff", message: "Nobody with that id is on the staff register." });
    }
    const person = rows[0];

    const [accounts, classes] = await Promise.all([
      query(
        `SELECT role, full_name, email, phone, created_at, last_login_at, is_admin
           FROM users WHERE staff_id = $1 ORDER BY created_at`,
        [id]
      ),
      query(
        `SELECT DISTINCT (t.class_level || t.class_arm) AS class_name,
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
        [`%${person.surname}%`]
      ),
    ]);

    return json(res, 200, {
      admin: identity(session),
      term: await currentTerm(),
      unreadMessages: await unreadCount(session.id),
      staff: staffShape(person),
      accounts: accounts.rows,
      classes: classes.rows,
    });
  }

  /* ------------------------------------------------------ the staff list */
  const q = String(url.searchParams.get("q") || "").trim().slice(0, 60);
  const status = url.searchParams.get("status") === "left" ? "left"
               : url.searchParams.get("status") === "all" ? null : "active";
  const page = Math.max(1, Math.min(400, Number(url.searchParams.get("page")) || 1));

  const where = [];
  const args = [];
  if (status) { args.push(status); where.push(`s.status = $${args.length}`); }
  if (q) {
    args.push(`%${q}%`);
    where.push(`(s.surname ILIKE $${args.length} OR s.other_names ILIKE $${args.length}
                 OR s.staff_no ILIKE $${args.length} OR s.email ILIKE $${args.length}
                 OR (s.other_names || ' ' || s.surname) ILIKE $${args.length})`);
  }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [count, rows, totals] = await Promise.all([
    query(`SELECT count(*)::int AS n FROM staff_register s ${filter}`, args),
    query(
      `SELECT s.*, ${WITH_TEACHING} FROM staff_register s ${filter}
        ORDER BY s.surname, s.other_names
        LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
      args
    ),
    query(
      `SELECT count(*) FILTER (WHERE status = 'active')::int AS active,
              count(*) FILTER (WHERE status = 'left')::int   AS left_school,
              count(*)::int                                  AS all_rows,
              (SELECT count(*)::int FROM users WHERE staff_id IS NOT NULL) AS accounts,
              (SELECT count(*)::int FROM users WHERE is_admin)             AS admins
         FROM staff_register`
    ),
  ]);

  const total = count.rows[0].n;
  return json(res, 200, {
    admin: identity(session),
    term: await currentTerm(),
    unreadMessages: await unreadCount(session.id),
    staff: rows.rows.map(staffShape),
    totals: totals.rows[0],
    page,
    pages: Math.max(1, Math.ceil(total / PER_PAGE)),
    perPage: PER_PAGE,
    total,
    filters: { q, status: status || "all" },
  });
});
