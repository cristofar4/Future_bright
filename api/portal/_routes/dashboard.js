/* GET /api/portal/dashboard
 *
 * Everything the student dashboard shows, for whoever the session cookie
 * belongs to. One round trip, so the page paints in a single pass.
 *
 * A student only ever sees their own row: every query is keyed on the
 * register_id attached to their session, never on anything from the request.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { homeFor, firstNameOf, initialsOf } from "../_student.js";

function greeting(hour) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const session = await getSessionUser(req);
    if (!session) {
      return json(res, 401, { error: "not_signed_in", message: "Please sign in to view your dashboard." });
    }
    if (session.role !== "student") {
      return json(res, 403, {
        error: "wrong_portal",
        message: "This dashboard is for pupils. Your own dashboard is a click away.",
        home: homeFor(session),
      });
    }

    const { rows: reg } = await query(
      `SELECT r.id, r.admission_no, r.surname, r.other_names, r.class_level, r.class_arm
         FROM register r JOIN users u ON u.register_id = r.id
        WHERE u.id = $1`,
      [session.id]
    );
    if (!reg.length) {
      return json(res, 404, { error: "no_record", message: "No school record is linked to this account." });
    }
    const student = reg[0];
    const klass = student.class_level + (student.class_arm || "");

    // Current term, or the next one if we are between terms.
    const { rows: terms } = await query(
      `SELECT session, term, label, starts_on, ends_on,
              greatest(0, (ends_on - current_date))::int AS days_left
         FROM terms
        WHERE ends_on >= current_date
        ORDER BY starts_on
        LIMIT 1`
    );
    const term = terms[0] || null;

    // Today's lessons; on a weekend, show Monday's.
    const { rows: today } = await query(
      `WITH target AS (
         SELECT CASE WHEN extract(isodow FROM current_date) > 5 THEN 1
                     ELSE extract(isodow FROM current_date)::int END AS weekday
       )
       SELECT to_char(t.starts_at, 'HH12:MI AM') AS starts_at,
              to_char(t.ends_at,   'HH12:MI AM') AS ends_at,
              -- 24-hour form too: the display string above does not sort.
              to_char(t.starts_at, 'HH24:MI')    AS starts_at_24,
              s.name AS subject, s.accent, s.icon, t.teacher, t.room,
              (SELECT weekday FROM target) AS weekday
         FROM timetable t
         JOIN subjects s ON s.id = t.subject_id
        WHERE t.class_level = $1 AND t.class_arm = $2
          AND t.weekday = (SELECT weekday FROM target)
        ORDER BY t.starts_at`,
      [student.class_level, student.class_arm]
    );

    const { rows: assignments } = await query(
      `SELECT a.id, a.title, a.brief, a.due_on, s.name AS subject, s.accent,
              (sub.assignment_id IS NOT NULL) AS submitted
         FROM assignments a
         JOIN subjects s ON s.id = a.subject_id
         LEFT JOIN assignment_submissions sub
                ON sub.assignment_id = a.id AND sub.register_id = $3
        WHERE a.class_level = $1 AND a.class_arm = $2
        ORDER BY a.due_on
        LIMIT 6`,
      [student.class_level, student.class_arm, student.id]
    );

    const { rows: results } = await query(
      `SELECT s.name AS subject, sr.score::float AS score
         FROM subject_results sr
         JOIN subjects s ON s.id = sr.subject_id
        WHERE sr.register_id = $1
        ORDER BY sr.score DESC, s.name`,
      [student.id]
    );

    const { rows: att } = await query(
      `SELECT count(*) FILTER (WHERE state = 'present')::int AS present,
              count(*) FILTER (WHERE state = 'absent')::int  AS absent,
              count(*) FILTER (WHERE state = 'late')::int    AS late,
              count(*)::int                                  AS total
         FROM attendance
        WHERE register_id = $1`,
      [student.id]
    );

    const { rows: announcements } = await query(
      `SELECT id, title, body, published_on
         FROM announcements
        WHERE audience IN ('all', 'students') AND published_on <= current_date
        ORDER BY published_on DESC
        LIMIT 4`
    );

    const { rows: unread } = await query(
      `SELECT count(*)::int AS n FROM messages WHERE user_id = $1 AND read_at IS NULL`,
      [session.id]
    );

    const attendance = att[0] || { present: 0, absent: 0, late: 0, total: 0 };
    const average = results.length
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : null;

    return json(res, 200, {
      student: {
        isAdmin: Boolean(session.is_admin),
        fullName: session.full_name,
        firstName: firstNameOf(student.other_names || session.full_name),
        admissionNo: student.admission_no,
        className: klass,
        initials: initialsOf(session.full_name),
      },
      greeting: greeting(new Date().getHours()),
      term: term && {
        session: term.session,
        label: term.label,
        daysLeft: term.days_left,
      },
      today,
      assignments,
      results,
      average,
      attendance: {
        ...attendance,
        // Percent of days marked present, which is what the design labels it.
        percent: attendance.total ? Math.round((attendance.present / attendance.total) * 100) : null,
      },
      announcements,
      unreadMessages: unread[0] ? unread[0].n : 0,
    });
  } catch (err) {
    if ((err.code === "NO_DATABASE" || err.code === "BAD_DATABASE_URL")) {
      return json(res, 503, { error: "not_configured", message: "The portal is not available yet." });
    }
    console.error("[dashboard]", err);
    return json(res, 500, { error: "server_error", message: "Something went wrong loading your dashboard." });
  }
}
