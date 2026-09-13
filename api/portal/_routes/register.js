/* GET  /api/portal/register?class=SS2A&date=YYYY-MM-DD - a class, ready to mark
 * POST /api/portal/register                            - save the marks
 *
 * Teaching staff only, and only for a class they teach. The class and every
 * pupil id in the body are checked against the register before anything is
 * written, so neither can reach a pupil the person signed in has no business
 * marking.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed, readJson, badBody } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { currentTerm, unreadCount, portalRoute, homeFor, firstNameOf, initialsOf } from "../_student.js";
import { classesFor, mayTeach, pupilsIn, isRealDate } from "../_teaching.js";

const STATES = ["present", "absent", "late"];

function identity(session) {
  return {
    isAdmin: Boolean(session.is_admin),
    fullName: session.full_name,
    firstName: firstNameOf(session.full_name),
    initials: initialsOf(session.full_name),
    email: session.email,
    role: session.role,
  };
}

const today = () => new Date().toISOString().slice(0, 10);

export default portalRoute(async function (req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  const session = await getSessionUser(req);
  if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
  if (session.role !== "teacher") {
    return json(res, 403, {
      error: "wrong_portal",
      message: "Registers are taken by teaching staff. Your own dashboard is a click away.",
      home: homeFor(session),
    });
  }

  /** The whole page, for whichever class and day is being looked at. */
  async function sheet(className, onDate, extra) {
    const { classes, all } = await classesFor(session);
    if (!classes.length) {
      return json(res, 200, {
        admin: identity(session), term: await currentTerm(),
        unreadMessages: await unreadCount(session.id),
        classes: [], className: null, date: onDate, pupils: [], summary: null, all,
        nothing: "No class on the timetable is yours yet, so there is no register to take.",
      });
    }
    const klass = classes.find((c) => c.class_name === className) || classes[0];
    const pupils = await pupilsIn(klass);

    const { rows: marks } = await query(
      `SELECT register_id, state FROM attendance
        WHERE on_date = $1::date AND register_id = ANY($2::bigint[])`,
      [onDate, pupils.map((p) => Number(p.id))]
    );
    const byId = new Map(marks.map((m) => [String(m.register_id), m.state]));
    const withState = pupils.map((p) => ({ ...p, state: byId.get(p.id) || null }));

    const counted = withState.filter((p) => p.state);
    return json(res, 200, {
      admin: identity(session),
      term: await currentTerm(),
      unreadMessages: await unreadCount(session.id),
      classes,
      className: klass.class_name,
      date: onDate,
      today: today(),
      pupils: withState,
      all,
      summary: {
        marked: counted.length,
        total: withState.length,
        present: counted.filter((p) => p.state === "present").length,
        absent: counted.filter((p) => p.state === "absent").length,
        late: counted.filter((p) => p.state === "late").length,
      },
      ...extra,
    });
  }

  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const asked = String(url.searchParams.get("date") || "").trim();
    const onDate = asked && isRealDate(asked) ? asked : today();
    if (onDate > today()) {
      return json(res, 400, {
        error: "future", field: "date",
        message: "You cannot take a register for a day that has not happened yet.",
      });
    }
    return sheet(String(url.searchParams.get("class") || "").trim(), onDate);
  }

  /* ------------------------------------------------------------- saving */
  let body;
  try { body = await readJson(req, 64 * 1024); } catch (err) { return badBody(req, res, err); }

  const onDate = typeof body.date === "string" ? body.date.trim() : "";
  if (!isRealDate(onDate)) {
    return json(res, 400, { error: "bad_date", field: "date", message: "Use a date like 2026-09-13." });
  }
  if (onDate > today()) {
    return json(res, 400, {
      error: "future", field: "date",
      message: "You cannot take a register for a day that has not happened yet.",
    });
  }

  const klass = await mayTeach(session, typeof body.class === "string" ? body.class.trim() : "");
  if (!klass) {
    return json(res, 403, { error: "not_your_class", field: "class", message: "That class is not one of yours." });
  }

  const marks = Array.isArray(body.marks) ? body.marks : [];
  if (!marks.length) {
    return json(res, 400, { error: "nothing", message: "Mark at least one pupil before saving." });
  }

  // Only pupils actually on this class's register may be marked, whatever ids
  // the body contains.
  const pupils = await pupilsIn(klass);
  const allowed = new Set(pupils.map((p) => p.id));
  const ids = [];
  const states = [];
  for (const m of marks) {
    const id = String(m && m.id);
    const state = m && typeof m.state === "string" ? m.state : "";
    if (!allowed.has(id)) {
      return json(res, 400, { error: "not_in_class", message: "That pupil is not on this class register." });
    }
    if (!STATES.includes(state)) {
      return json(res, 400, { error: "bad_state", message: "Mark each pupil present, absent or late." });
    }
    ids.push(Number(id));
    states.push(state);
  }

  await query(
    `INSERT INTO attendance (register_id, on_date, state)
     SELECT id, $2::date, state
       FROM unnest($1::bigint[], $3::text[]) AS m(id, state)
     ON CONFLICT (register_id, on_date) DO UPDATE SET state = EXCLUDED.state`,
    [ids, onDate, states]
  );

  return sheet(klass.class_name, onDate, {
    ok: true,
    message: `Register saved for ${klass.class_name} on ${onDate}.`,
  });
});
