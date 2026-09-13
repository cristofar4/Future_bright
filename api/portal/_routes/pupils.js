/* GET /api/portal/pupils          - the roll, searchable and by class
 * GET /api/portal/pupils?id=N     - one pupil's whole record
 *
 * The only view that reads across pupils, so it is gated on users.is_admin
 * rather than on a role, exactly as the admin dashboard is. Nothing here
 * returns a password hash or a session token.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { currentTerm, unreadCount, portalRoute, homeFor, firstNameOf, initialsOf } from "../_student.js";

const PER_PAGE = 25;

/** Everything the header of either view needs. */
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

function pupilShape(row) {
  const name = [row.other_names, row.surname].filter(Boolean).join(" ").trim();
  return {
    id: String(row.id),
    admissionNo: row.admission_no,
    fullName: name,
    surname: row.surname,
    otherNames: row.other_names,
    initials: initialsOf(name),
    className: row.class_level + (row.class_arm || ""),
    classLevel: row.class_level,
    status: row.status,
    source: row.source,
    guardianEmail: row.guardian_email,
    guardianPhone: row.guardian_phone,
    joinedOn: row.created_at,
    accounts: row.accounts,
  };
}

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const session = await getSessionUser(req);
  if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
  if (!session.is_admin) {
    return json(res, 403, {
      error: "not_admin",
      message: "The roll is for administrators. Your own dashboard is a click away.",
      home: homeFor(session),
    });
  }

  const url = new URL(req.url, "http://localhost");
  const wanted = url.searchParams.get("id");

  /* ---------------------------------------------------- one pupil's record */
  if (wanted !== null) {
    const id = Number(wanted);
    if (!Number.isInteger(id) || id <= 0) {
      return json(res, 400, { error: "bad_id", message: "Which pupil?" });
    }

    const { rows } = await query(
      `SELECT r.*, (SELECT count(*)::int FROM users u WHERE u.register_id = r.id) AS accounts
         FROM register r WHERE r.id = $1`,
      [id]
    );
    if (!rows.length) {
      return json(res, 404, { error: "no_pupil", message: "No pupil with that id is on the register." });
    }
    const pupil = rows[0];

    const [accounts, results, att, tasks] = await Promise.all([
      // Names, roles and sign-in times only: never a hash, never a session.
      query(
        `SELECT role, full_name, email, phone, created_at, last_login_at
           FROM users WHERE register_id = $1 ORDER BY role`,
        [id]
      ),
      query(
        `SELECT s.name AS subject, sr.score::float AS score
           FROM subject_results sr JOIN subjects s ON s.id = sr.subject_id
          WHERE sr.register_id = $1 ORDER BY sr.score DESC`,
        [id]
      ),
      query(
        `SELECT count(*) FILTER (WHERE state = 'present')::int AS present,
                count(*) FILTER (WHERE state = 'absent')::int  AS absent,
                count(*) FILTER (WHERE state = 'late')::int    AS late,
                count(*)::int                                  AS total
           FROM attendance WHERE register_id = $1`,
        [id]
      ),
      query(
        `SELECT a.title, a.due_on, s.name AS subject,
                (sub.assignment_id IS NOT NULL) AS submitted
           FROM assignments a
           JOIN subjects s ON s.id = a.subject_id
           LEFT JOIN assignment_submissions sub
                  ON sub.assignment_id = a.id AND sub.register_id = $1
          WHERE a.class_level = $2 AND a.class_arm = $3
          ORDER BY a.due_on`,
        [id, pupil.class_level, pupil.class_arm || "A"]
      ),
    ]);

    const attendance = att.rows[0] || { present: 0, absent: 0, late: 0, total: 0 };
    attendance.percent = attendance.total
      ? Math.round((attendance.present / attendance.total) * 100) : null;
    const average = results.rows.length
      ? Math.round(results.rows.reduce((n, r) => n + r.score, 0) / results.rows.length) : null;

    return json(res, 200, {
      admin: identity(session),
      term: await currentTerm(),
      unreadMessages: await unreadCount(session.id),
      pupil: pupilShape(pupil),
      accounts: accounts.rows,
      results: results.rows,
      average,
      attendance,
      assignments: tasks.rows,
    });
  }

  /* ------------------------------------------------------------- the roll */
  const q = String(url.searchParams.get("q") || "").trim().slice(0, 60);
  const klass = String(url.searchParams.get("class") || "").trim().slice(0, 12);
  const status = url.searchParams.get("status") === "left" ? "left"
               : url.searchParams.get("status") === "all" ? null : "active";
  const page = Math.max(1, Math.min(400, Number(url.searchParams.get("page")) || 1));

  // Every value is a parameter; none of it is concatenated into the SQL.
  const where = [];
  const args = [];
  if (status) { args.push(status); where.push(`r.status = $${args.length}`); }
  if (klass) {
    args.push(klass);
    where.push(`(r.class_level || coalesce(nullif(r.class_arm,''),'A')) = $${args.length}`);
  }
  if (q) {
    args.push(`%${q}%`);
    where.push(`(r.surname ILIKE $${args.length} OR r.other_names ILIKE $${args.length}
                 OR r.admission_no ILIKE $${args.length}
                 OR (r.other_names || ' ' || r.surname) ILIKE $${args.length})`);
  }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [count, rows, classes, totals] = await Promise.all([
    query(`SELECT count(*)::int AS n FROM register r ${filter}`, args),
    query(
      `SELECT r.*, (SELECT count(*)::int FROM users u WHERE u.register_id = r.id) AS accounts
         FROM register r ${filter}
        ORDER BY r.class_level, coalesce(nullif(r.class_arm,''),'A'), r.surname, r.other_names
        LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
      args
    ),
    query(
      `SELECT (class_level || coalesce(nullif(class_arm,''),'A')) AS class_name,
              count(*)::int AS pupils
         FROM register WHERE status = 'active'
        GROUP BY 1 ORDER BY 1`
    ),
    query(
      `SELECT count(*) FILTER (WHERE status = 'active')::int AS active,
              count(*) FILTER (WHERE status = 'left')::int   AS left_school,
              count(*)::int                                  AS all_rows,
              (SELECT count(*)::int FROM users WHERE register_id IS NOT NULL) AS accounts
         FROM register`
    ),
  ]);

  const total = count.rows[0].n;
  return json(res, 200, {
    admin: identity(session),
    term: await currentTerm(),
    unreadMessages: await unreadCount(session.id),
    pupils: rows.rows.map(pupilShape),
    classes: classes.rows,
    totals: totals.rows[0],
    page,
    pages: Math.max(1, Math.ceil(total / PER_PAGE)),
    perPage: PER_PAGE,
    total,
    filters: { q, class: klass, status: status || "all" },
  });
});
