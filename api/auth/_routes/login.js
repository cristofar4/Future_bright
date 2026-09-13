/* POST /api/auth/login - email and password, returns a session cookie. */
import { query } from "../../_lib/db.js";
import { verifyPassword, dummyVerify } from "../../_lib/crypto.js";
import { json, methodNotAllowed, readJson, badBody, setSessionCookie, clientIp } from "../../_lib/http.js";
import { createSession, publicUser, pruneSessions } from "../../_lib/session.js";
import { checkRateLimit, recordAttempt } from "../../_lib/rate.js";
import { str, normaliseEmail, isEmail } from "../../_lib/validate.js";

// One message for every failure: a wrong password and an unknown address must
// look identical, or the form becomes a way to test which emails are registered.
const BAD_CREDENTIALS = "Email or password is incorrect.";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const ip = clientIp(req);
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return badBody(req, res, err);
  }

  const email = normaliseEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";

  if (!isEmail(email) || !password) {
    return json(res, 400, { error: "missing_fields", message: "Please enter your email address and password." });
  }

  try {
    const limited = await checkRateLimit("login", ip, email);
    if (limited) return json(res, 429, { error: "rate_limited", message: limited });

    const { rows } = await query(
      `SELECT u.id, u.role, u.full_name, u.email, u.phone, u.password_hash,
              r.admission_no, r.class_level, s.staff_no
         FROM users u
         LEFT JOIN register r       ON r.id = u.register_id
         LEFT JOIN staff_register s ON s.id = u.staff_id
        WHERE lower(u.email) = $1`,
      [email]
    );
    const user = rows[0];

    // Spend the same time hashing whether or not the account exists.
    const ok = user ? await verifyPassword(password, user.password_hash) : (await dummyVerify(), false);

    if (!ok) {
      await recordAttempt("login", ip, email, false);
      return json(res, 401, { error: "bad_credentials", message: BAD_CREDENTIALS });
    }

    await recordAttempt("login", ip, email, true);
    await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);
    pruneSessions().catch(() => {});

    const token = await createSession(user.id, req.headers["user-agent"]);
    setSessionCookie(req, res, token);
    return json(res, 200, { user: publicUser(user) });
  } catch (err) {
    if (err.code === "NO_DATABASE") {
      console.error("[login] DATABASE_URL is not configured");
      return json(res, 503, {
        error: "not_configured",
        message: "The portal is not available yet. Please contact the school office.",
      });
    }
    console.error("[login]", err);
    return json(res, 500, { error: "server_error", message: "Something went wrong. Please try again." });
  }
}
