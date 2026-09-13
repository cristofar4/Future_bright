/* Shared by every portal endpoint: resolve the session to a pupil's register
 * row, or produce the right refusal. Nothing downstream reads an identifier
 * from the request, so a pupil can only ever reach their own record.
 */
import { query } from "../_lib/db.js";
import { json } from "../_lib/http.js";
import { getSessionUser } from "../_lib/session.js";

/**
 * Returns { session, student } on success, or null after having already
 * written the response.
 */
export async function requireStudent(req, res) {
  const session = await getSessionUser(req);
  if (!session) {
    json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
    return null;
  }
  if (session.role !== "student") {
    json(res, 403, {
      error: "wrong_portal",
      message: "This page is for students. A parent and staff view is not built yet.",
    });
    return null;
  }

  const { rows } = await query(
    `SELECT r.id, r.admission_no, r.surname, r.other_names, r.class_level, r.class_arm, r.created_at
       FROM register r JOIN users u ON u.register_id = r.id
      WHERE u.id = $1`,
    [session.id]
  );
  if (!rows.length) {
    json(res, 404, { error: "no_record", message: "No school record is linked to this account." });
    return null;
  }
  return { session, student: rows[0] };
}

/** Identity block every section page shows in its header. */
export function studentSummary(session, student) {
  return {
    fullName: session.full_name,
    firstName: (student.other_names || session.full_name).split(/\s+/)[0],
    admissionNo: student.admission_no,
    className: student.class_level + (student.class_arm || ""),
    initials: session.full_name.split(/\s+/).filter(Boolean).slice(0, 2)
      .map((p) => p[0].toUpperCase()).join(""),
  };
}

export async function currentTerm() {
  const { rows } = await query(
    `SELECT session, term, label, greatest(0, (ends_on - current_date))::int AS days_left
       FROM terms WHERE ends_on >= current_date ORDER BY starts_on LIMIT 1`
  );
  return rows[0]
    ? { session: rows[0].session, term: rows[0].term, label: rows[0].label, daysLeft: rows[0].days_left }
    : null;
}

export async function unreadCount(userId) {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM messages WHERE user_id = $1 AND read_at IS NULL`, [userId]
  );
  return rows[0] ? rows[0].n : 0;
}

/** Wrap a handler so database and session failures are reported consistently. */
export function portalRoute(fn) {
  return async function (req, res) {
    try {
      await fn(req, res);
    } catch (err) {
      if (err.code === "NO_DATABASE") {
        return json(res, 503, {
          error: "not_configured",
          message: "The portal is not connected to a database yet. Open the demo preview to see how it looks.",
        });
      }
      console.error("[portal]", err);
      return json(res, 500, { error: "server_error", message: "Something went wrong. Please try again." });
    }
  };
}
