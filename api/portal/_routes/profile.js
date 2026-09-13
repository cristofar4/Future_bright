/* GET /api/portal/profile - the pupil's own record and the subjects they take. */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { requireStudent, studentSummary, currentTerm, unreadCount, portalRoute } from "../_student.js";

export default portalRoute(async function (req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const ctx = await requireStudent(req, res);
  if (!ctx) return;

  const { rows: subjects } = await query(
    `SELECT DISTINCT s.name AS subject
       FROM timetable t JOIN subjects s ON s.id = t.subject_id
      WHERE t.class_level = $1 AND t.class_arm = $2
      ORDER BY s.name`,
    [ctx.student.class_level, ctx.student.class_arm]
  );
  const { rows: guardian } = await query(
    `SELECT guardian_email, guardian_phone FROM register WHERE id = $1`,
    [ctx.student.id]
  );

  return json(res, 200, {
    student: {
      ...studentSummary(ctx.session, ctx.student),
      email: ctx.session.email,
      phone: ctx.session.phone,
      surname: ctx.student.surname,
      otherNames: ctx.student.other_names,
      guardianEmail: guardian[0] ? guardian[0].guardian_email : null,
      guardianPhone: guardian[0] ? guardian[0].guardian_phone : null,
      joinedOn: ctx.student.created_at,
      lastLogin: ctx.session.last_login_at,
    },
    term: await currentTerm(),
    unreadMessages: await unreadCount(ctx.session.id),
    subjects: subjects.map((s) => s.subject),
  });
});
