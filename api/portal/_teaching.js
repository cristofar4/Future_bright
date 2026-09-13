/* Who may write to which class.
 *
 * A teacher may take the register and enter results for the classes they
 * actually teach, matched on the name recorded against the timetable, the same
 * way their dashboard finds their own periods. An administrator may do it for
 * any class: a head standing in for an absent teacher should not be locked out
 * of their own school.
 *
 * Every write goes through mayTeach(), so a class name in a request body can
 * never reach a class the person signed in has no business in.
 */
import { query } from "../_lib/db.js";

/** The surname the timetable would record for this person, or null. */
async function surnameOf(session) {
  const { rows } = await query(
    `SELECT s.surname FROM staff_register s JOIN users u ON u.staff_id = s.id WHERE u.id = $1`,
    [session.id]
  );
  return rows.length ? rows[0].surname : null;
}

/** { classes: [{class_name, class_level, class_arm, pupils, subjects}], all: bool } */
export async function classesFor(session) {
  const all = Boolean(session.is_admin);

  if (all) {
    const { rows } = await query(
      `SELECT (r.class_level || coalesce(nullif(r.class_arm,''),'A')) AS class_name,
              r.class_level,
              coalesce(nullif(r.class_arm,''),'A') AS class_arm,
              count(*)::int AS pupils
         FROM register r WHERE r.status = 'active'
        GROUP BY 1, 2, 3 ORDER BY 1`
    );
    return { classes: rows, all: true };
  }

  const surname = await surnameOf(session);
  if (!surname) return { classes: [], all: false };

  const { rows } = await query(
    `SELECT DISTINCT (t.class_level || t.class_arm) AS class_name,
            t.class_level, t.class_arm,
            (SELECT count(*)::int FROM register r
              WHERE r.class_level = t.class_level AND r.class_arm = t.class_arm
                AND r.status = 'active') AS pupils
       FROM timetable t
      WHERE t.teacher ILIKE $1
      ORDER BY class_name`,
    [`%${surname}%`]
  );
  return { classes: rows, all: false };
}

/** The class a request asked for, or null if it is not theirs to write to. */
export async function mayTeach(session, className) {
  const { classes } = await classesFor(session);
  if (!classes.length) return null;
  if (!className) return classes[0];
  return classes.find((c) => c.class_name === className) || null;
}

/** The subjects this person may enter results for in a class. */
export async function subjectsFor(session, klass) {
  if (session.is_admin) {
    const { rows } = await query(`SELECT id, name FROM subjects ORDER BY name`);
    return rows;
  }
  const surname = await surnameOf(session);
  if (!surname) return [];
  const { rows } = await query(
    `SELECT DISTINCT s.id, s.name
       FROM timetable t JOIN subjects s ON s.id = t.subject_id
      WHERE t.teacher ILIKE $1 AND t.class_level = $2 AND t.class_arm = $3
      ORDER BY s.name`,
    [`%${surname}%`, klass.class_level, klass.class_arm]
  );
  return rows;
}

/** The pupils on the register for a class, in the order a register is called. */
export async function pupilsIn(klass) {
  const { rows } = await query(
    `SELECT id, admission_no, surname, other_names
       FROM register
      WHERE class_level = $1 AND coalesce(nullif(class_arm,''),'A') = $2 AND status = 'active'
      ORDER BY surname, other_names`,
    [klass.class_level, klass.class_arm]
  );
  return rows.map((r) => {
    const name = [r.other_names, r.surname].filter(Boolean).join(" ").trim();
    return {
      id: String(r.id),
      admissionNo: r.admission_no,
      fullName: name,
      surname: r.surname,              // a register is called by surname

      initials: name.split(/\s+/).filter(Boolean).slice(0, 2)
        .map((p) => p[0].toUpperCase()).join(""),
    };
  });
}

/** Exactly YYYY-MM-DD, and a day that really exists. */
export function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === value;
}
