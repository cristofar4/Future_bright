/* GET /api/portal/timetable            - every class in the school
 * GET /api/portal/timetable?class=SS2A - one class: its week, its staff, its pupils
 *
 * The administrator's view of classes. Read-only: changing a timetable means
 * changing the school's own data, which belongs with the import rather than
 * with a page anyone can reach in two clicks.
 *
 * Named for what it returns rather than for the page, because /api/portal/
 * classes is already the pupil's own weekly timetable.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { currentTerm, unreadCount, portalRoute, homeFor, firstNameOf, initialsOf } from "../_student.js";
import { pupilsIn } from "../_teaching.js";

const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

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

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const session = await getSessionUser(req);
  if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
  if (!session.is_admin) {
    return json(res, 403, {
      error: "not_admin",
      message: "Classes are for administrators. Your own dashboard is a click away.",
      home: homeFor(session),
    });
  }

  /* Every class the school has: one on the register, one on the timetable, or
     both. A class with pupils and no timetable is worth seeing, and so is a
     timetable nobody is enrolled in. */
  const { rows: classes } = await query(
    `WITH named AS (
       SELECT (class_level || coalesce(nullif(class_arm,''),'A')) AS class_name,
              class_level, coalesce(nullif(class_arm,''),'A') AS class_arm
         FROM register WHERE status = 'active'
       UNION
       SELECT (class_level || class_arm), class_level, class_arm FROM timetable
     )
     SELECT n.class_name, n.class_level, n.class_arm,
            (SELECT count(*)::int FROM register r
              WHERE r.class_level = n.class_level
                AND coalesce(nullif(r.class_arm,''),'A') = n.class_arm
                AND r.status = 'active') AS pupils,
            (SELECT count(*)::int FROM timetable t
              WHERE t.class_level = n.class_level AND t.class_arm = n.class_arm) AS periods,
            (SELECT count(DISTINCT t.subject_id)::int FROM timetable t
              WHERE t.class_level = n.class_level AND t.class_arm = n.class_arm) AS subjects,
            (SELECT count(DISTINCT t.teacher)::int FROM timetable t
              WHERE t.class_level = n.class_level AND t.class_arm = n.class_arm) AS teachers
       FROM named n ORDER BY n.class_name`
  );

  const url = new URL(req.url, "http://localhost");
  const wanted = String(url.searchParams.get("class") || "").trim();

  const base = {
    admin: identity(session),
    term: await currentTerm(),
    unreadMessages: await unreadCount(session.id),
    classes,
    totals: {
      classes: classes.length,
      pupils: classes.reduce((n, c) => n + c.pupils, 0),
      periods: classes.reduce((n, c) => n + c.periods, 0),
      empty: classes.filter((c) => !c.periods).length,
    },
  };

  if (!wanted) return json(res, 200, base);

  const klass = classes.find((c) => c.class_name === wanted);
  if (!klass) {
    return json(res, 404, { error: "no_class", message: "No class by that name." });
  }

  const [week, staff, pupils] = await Promise.all([
    query(
      `SELECT t.weekday,
              to_char(t.starts_at, 'HH12:MI AM') AS starts_at,
              to_char(t.ends_at,   'HH12:MI AM') AS ends_at,
              to_char(t.starts_at, 'HH24:MI')    AS starts_at_24,
              s.name AS subject, s.accent, s.icon, t.teacher, t.room
         FROM timetable t JOIN subjects s ON s.id = t.subject_id
        WHERE t.class_level = $1 AND t.class_arm = $2
        ORDER BY t.weekday, t.starts_at`,
      [klass.class_level, klass.class_arm]
    ),
    query(
      `SELECT t.teacher,
              string_agg(DISTINCT s.name, ', ' ORDER BY s.name) AS subjects,
              count(*)::int AS periods
         FROM timetable t JOIN subjects s ON s.id = t.subject_id
        WHERE t.class_level = $1 AND t.class_arm = $2
        GROUP BY t.teacher ORDER BY t.teacher`,
      [klass.class_level, klass.class_arm]
    ),
    pupilsIn(klass),
  ]);

  const days = [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    name: DAYS[weekday],
    lessons: week.rows.filter((l) => l.weekday === weekday),
  }));

  return json(res, 200, {
    ...base,
    className: klass.class_name,
    klass,
    week: days,
    staff: staff.rows,
    pupils,
  });
});
