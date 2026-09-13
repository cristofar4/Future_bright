/* GET  /api/portal/marks?class=SS2A&subject=3 - a class and subject, ready to score
 * POST /api/portal/marks                      - save the scores
 *
 * Teaching staff only, and only for a class they teach and a subject they teach
 * in it. Scores belong to the term that is running: there is nowhere to put
 * them otherwise, so the endpoint says so rather than inventing one.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed, readJson, badBody } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { currentTerm, unreadCount, portalRoute, homeFor, firstNameOf, initialsOf } from "../_student.js";
import { classesFor, mayTeach, subjectsFor, pupilsIn } from "../_teaching.js";

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

/** WAEC, the same scale the pupil's report card uses. */
function grade(score) {
  if (score >= 75) return "A1";
  if (score >= 70) return "B2";
  if (score >= 65) return "B3";
  if (score >= 60) return "C4";
  if (score >= 55) return "C5";
  if (score >= 50) return "C6";
  if (score >= 45) return "D7";
  if (score >= 40) return "E8";
  return "F9";
}

export default portalRoute(async function (req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  const session = await getSessionUser(req);
  if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });
  if (session.role !== "teacher") {
    return json(res, 403, {
      error: "wrong_portal",
      message: "Results are entered by teaching staff. Your own dashboard is a click away.",
      home: homeFor(session),
    });
  }

  const term = await currentTerm();

  async function sheet(className, subjectId, extra) {
    const { classes, all } = await classesFor(session);
    const base = {
      admin: identity(session),
      term,
      unreadMessages: await unreadCount(session.id),
      classes, all,
    };

    if (!classes.length) {
      return json(res, 200, {
        ...base, className: null, subjects: [], subjectId: null, pupils: [],
        nothing: "No class on the timetable is yours yet, so there are no results to enter.",
      });
    }
    if (!term) {
      return json(res, 200, {
        ...base, className: classes[0].class_name, subjects: [], subjectId: null, pupils: [],
        nothing: "No term is running, so there is nowhere to file a score yet.",
      });
    }

    const klass = classes.find((c) => c.class_name === className) || classes[0];
    const subjects = await subjectsFor(session, klass);
    if (!subjects.length) {
      return json(res, 200, {
        ...base, className: klass.class_name, subjects: [], subjectId: null, pupils: [],
        nothing: `You do not teach a subject to ${klass.class_name}.`,
      });
    }

    const subject = subjects.find((s) => String(s.id) === String(subjectId)) || subjects[0];
    const pupils = await pupilsIn(klass);

    const { rows: have } = await query(
      `SELECT register_id, score::float AS score FROM subject_results
        WHERE subject_id = $1 AND session = $2 AND term = $3
          AND register_id = ANY($4::bigint[])`,
      [subject.id, term.session, term.term, pupils.map((p) => Number(p.id))]
    );
    const byId = new Map(have.map((r) => [String(r.register_id), r.score]));
    const scored = pupils.map((p) => {
      const score = byId.has(p.id) ? byId.get(p.id) : null;
      return { ...p, score, grade: score === null ? null : grade(score) };
    });

    const entered = scored.filter((p) => p.score !== null);
    return json(res, 200, {
      ...base,
      className: klass.class_name,
      subjects,
      subjectId: String(subject.id),
      subjectName: subject.name,
      pupils: scored,
      summary: {
        entered: entered.length,
        total: scored.length,
        average: entered.length
          ? Math.round(entered.reduce((n, p) => n + p.score, 0) / entered.length) : null,
      },
      ...extra,
    });
  }

  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    return sheet(String(url.searchParams.get("class") || "").trim(),
                 String(url.searchParams.get("subject") || "").trim());
  }

  /* ------------------------------------------------------------- saving */
  if (!term) {
    return json(res, 409, {
      error: "no_term",
      message: "No term is running, so there is nowhere to file a score yet.",
    });
  }

  let body;
  try { body = await readJson(req, 64 * 1024); } catch (err) { return badBody(req, res, err); }

  const klass = await mayTeach(session, typeof body.class === "string" ? body.class.trim() : "");
  if (!klass) {
    return json(res, 403, { error: "not_your_class", field: "class", message: "That class is not one of yours." });
  }

  const subjects = await subjectsFor(session, klass);
  const subject = subjects.find((s) => String(s.id) === String(body.subject));
  if (!subject) {
    return json(res, 403, {
      error: "not_your_subject", field: "subject",
      message: `You do not teach that subject to ${klass.class_name}.`,
    });
  }

  const rows = Array.isArray(body.scores) ? body.scores : [];
  if (!rows.length) {
    return json(res, 400, { error: "nothing", message: "Enter at least one score before saving." });
  }

  const pupils = await pupilsIn(klass);
  const allowed = new Set(pupils.map((p) => p.id));

  const setIds = [];
  const setScores = [];
  const clearIds = [];
  for (const row of rows) {
    const id = String(row && row.id);
    if (!allowed.has(id)) {
      return json(res, 400, { error: "not_in_class", message: "That pupil is not in this class." });
    }
    // An empty box means "no score recorded", which is different from zero.
    if (row.score === null || row.score === undefined || row.score === "") {
      clearIds.push(Number(id));
      continue;
    }
    const score = Number(row.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return json(res, 400, {
        error: "bad_score", field: "score", pupil: id,
        message: "Scores run from 0 to 100.",
      });
    }
    setIds.push(Number(id));
    setScores.push(Math.round(score * 100) / 100);
  }

  if (setIds.length) {
    await query(
      `INSERT INTO subject_results (register_id, subject_id, session, term, score)
       SELECT id, $2::bigint, $3::text, $4::smallint, score
         FROM unnest($1::bigint[], $5::numeric[]) AS s(id, score)
       ON CONFLICT (register_id, subject_id, session, term)
       DO UPDATE SET score = EXCLUDED.score`,
      [setIds, subject.id, term.session, term.term, setScores]
    );
  }
  if (clearIds.length) {
    await query(
      `DELETE FROM subject_results
        WHERE subject_id = $1 AND session = $2 AND term = $3 AND register_id = ANY($4::bigint[])`,
      [subject.id, term.session, term.term, clearIds]
    );
  }

  return sheet(klass.class_name, String(subject.id), {
    ok: true,
    message: `${subject.name} results saved for ${klass.class_name}.`,
  });
});
