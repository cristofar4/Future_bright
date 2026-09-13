/* POST /api/auth/signup
 *
 * Creates a portal account, but only for someone who already appears in the
 * school's register. The fields are exactly those on the sign-up design; the
 * difference is that the admission number is checked rather than just stored.
 *
 *   student -> admission number must exist, be active, match the class chosen,
 *              and the surname on file must appear in the name given
 *   parent  -> the same, plus the email or phone given must match the guardian
 *              contact details already held for that child
 *   teacher -> staff number must exist and be active, with a surname match
 *
 * Failures return one generic message so the endpoint cannot be used to work
 * out who attends or teaches at the school.
 */
import { query } from "../../_lib/db.js";
import { isOpenSignup } from "../_mode.js";
import { hashPassword } from "../../_lib/crypto.js";
import { json, methodNotAllowed, readJson, badBody, setSessionCookie, clientIp } from "../../_lib/http.js";
import { createSession, publicUser } from "../../_lib/session.js";
import { checkRateLimit, recordAttempt, pruneAttempts } from "../../_lib/rate.js";
import {
  CLASS_LEVELS, ROLES, str, normaliseRef, normaliseEmail, normalisePhone,
  isEmail, checkPassword, checkFullName, nameMatchesSurname,
} from "../../_lib/validate.js";

const NO_MATCH =
  "Those details do not match our records. Please check them against your admission letter, " +
  "or contact the school office on +234 801 234 5678.";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const ip = clientIp(req);
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return badBody(req, res, err);
  }

  const role = str(body.role, 20).toLowerCase();
  const fullName = str(body.fullName, 120);
  const email = normaliseEmail(body.email);
  const phoneRaw = str(body.phone, 40);
  const reference = normaliseRef(body.reference);     // admission number, or staff number
  const classLevel = str(body.classLevel, 10).toUpperCase();
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  // ---- shape checks, before any database work ----------------------------
  if (!ROLES.includes(role)) {
    return json(res, 400, { error: "invalid_role", message: "Please choose Student, Parent or Teacher." });
  }

  const nameError = checkFullName(fullName);
  if (nameError) return json(res, 400, { error: "invalid_name", field: "fullName", message: nameError });

  if (!isEmail(email)) {
    return json(res, 400, { error: "invalid_email", field: "email", message: "Please enter a valid email address." });
  }
  if (!reference) {
    return json(res, 400, {
      error: "missing_reference",
      field: "reference",
      message: role === "teacher" ? "Please enter your staff number." : "Please enter the admission number.",
    });
  }
  if (role !== "teacher" && !CLASS_LEVELS.includes(classLevel)) {
    return json(res, 400, { error: "invalid_class", field: "classLevel", message: "Please select a class." });
  }
  if (password !== confirmPassword) {
    return json(res, 400, { error: "password_mismatch", field: "confirmPassword", message: "The two passwords do not match." });
  }
  const passwordError = checkPassword(password, { email, fullName });
  if (passwordError) {
    return json(res, 400, { error: "weak_password", field: "password", message: passwordError });
  }

  try {
    const limited = await checkRateLimit("signup", ip, reference);
    if (limited) {
      return json(res, 429, { error: "rate_limited", message: limited });
    }

    // Rate limiting still applies in open mode, so it cannot be used to bulk
    // create accounts.
    const openSignup = await isOpenSignup();

    // ---- verify against the register ------------------------------------
    let registerId = null;
    let staffId = null;

    if (role === "teacher") {
      const { rows } = await query(
        `SELECT id, surname, email, status
           FROM staff_register
          WHERE upper(replace(staff_no, ' ', '')) = $1`,
        [reference]
      );
      let staff = rows[0];

      if (!staff && openSignup) {
        const parts = fullName.split(/\s+/).filter(Boolean);
        const created = await query(
          `INSERT INTO staff_register (staff_no, surname, other_names, email, status, source)
           VALUES ($1, $2, $3, $4, 'active', 'signup')
           ON CONFLICT (upper(replace(staff_no, ' ', ''))) DO NOTHING
           RETURNING id, surname, email, status`,
          [reference, parts[parts.length - 1], parts.slice(0, -1).join(" "), email]
        );
        staff = created.rows[0];
      }

      const emailOnFile = normaliseEmail(staff?.email || "");
      const ok =
        staff &&
        staff.status === "active" &&
        nameMatchesSurname(fullName, staff.surname) &&
        // If the school recorded an email for this member of staff, it must be the one used.
        (!emailOnFile || emailOnFile === email);

      if (!ok) {
        await recordAttempt("signup", ip, reference, false);
        return json(res, 400, { error: "no_match", message: NO_MATCH });
      }
      staffId = staff.id;
    } else {
      const { rows } = await query(
        `SELECT id, surname, class_level, guardian_email, guardian_phone, status
           FROM register
          WHERE upper(replace(admission_no, ' ', '')) = $1`,
        [reference]
      );
      let student = rows[0];

      // Open sign-up (a deployment with no register yet, or the override set):
      // create the register entry from what was typed instead of refusing.
      if (!student && openSignup) {
        const parts = fullName.split(/\s+/).filter(Boolean);
        const created = await query(
          `INSERT INTO register (admission_no, surname, other_names, class_level, class_arm,
                                 guardian_email, guardian_phone, status, source)
           VALUES ($1, $2, $3, $4, 'A', NULLIF($5,''), NULLIF($6,''), 'active', 'signup')
           ON CONFLICT (upper(replace(admission_no, ' ', ''))) DO NOTHING
           RETURNING id, surname, class_level, guardian_email, guardian_phone, status`,
          [reference, parts[parts.length - 1], parts.slice(0, -1).join(" "), classLevel,
           role === "parent" ? email : "", role === "parent" ? phoneRaw : ""]
        );
        student = created.rows[0];
      }

      let ok =
        student &&
        student.status === "active" &&
        student.class_level.toUpperCase() === classLevel &&
        (role === "parent" || nameMatchesSurname(fullName, student.surname));

      // A parent additionally has to reach us on a contact we already hold, so
      // knowing a child's admission number is not by itself enough.
      if (ok && role === "parent") {
        const emailOnFile = normaliseEmail(student.guardian_email || "");
        const phoneOnFile = normalisePhone(student.guardian_phone || "");
        const phoneGiven = normalisePhone(phoneRaw);
        ok =
          (emailOnFile && emailOnFile === email) ||
          (phoneOnFile && phoneGiven && phoneOnFile === phoneGiven);
      }

      if (!ok) {
        await recordAttempt("signup", ip, reference, false);
        return json(res, 400, { error: "no_match", message: NO_MATCH });
      }
      registerId = student.id;
    }

    // ---- create the account ---------------------------------------------
    const passwordHash = await hashPassword(password);
    let created;
    try {
      const { rows } = await query(
        `INSERT INTO users (role, full_name, email, phone, password_hash, register_id, staff_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, role, full_name, email, phone`,
        [role, fullName, email, phoneRaw || null, passwordHash, registerId, staffId]
      );
      created = rows[0];
    } catch (err) {
      if (err.code === "23505") {                       // unique_violation
        await recordAttempt("signup", ip, reference, false);
        const claimed = String(err.constraint || "").includes("email")
          ? "There is already an account with that email address. Try signing in instead."
          : "An account has already been created for these details. Try signing in, or contact the school office.";
        return json(res, 409, { error: "already_exists", message: claimed });
      }
      throw err;
    }

    await recordAttempt("signup", ip, reference, true);
    pruneAttempts().catch(() => {});                    // best effort, never blocks the response

    const token = await createSession(created.id, req.headers["user-agent"]);
    setSessionCookie(req, res, token);

    const { rows: full } = await query(
      `SELECT u.id, u.role, u.full_name, u.email, u.phone,
              r.admission_no, r.class_level, s.staff_no
         FROM users u
         LEFT JOIN register r       ON r.id = u.register_id
         LEFT JOIN staff_register s ON s.id = u.staff_id
        WHERE u.id = $1`,
      [created.id]
    );
    return json(res, 201, { user: publicUser(full[0]) });
  } catch (err) {
    if (err.code === "NO_DATABASE") {
      console.error("[signup] DATABASE_URL is not configured");
      return json(res, 503, {
        error: "not_configured",
        message: "The portal is not available yet. Please contact the school office.",
      });
    }
    console.error("[signup]", err);
    return json(res, 500, { error: "server_error", message: "Something went wrong. Please try again." });
  }
}
