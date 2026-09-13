/* POST /api/portal/password - change the signed-in user's password.
 *
 * The current password is required, so a borrowed session cannot be used to
 * lock the real owner out. Every other session is dropped on success.
 */
import { query } from "../../_lib/db.js";
import { hashPassword, verifyPassword, hashToken } from "../../_lib/crypto.js";
import { json, methodNotAllowed, readJson, badBody, parseCookies, SESSION_COOKIE } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { checkPassword } from "../../_lib/validate.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const session = await getSessionUser(req);
    if (!session) return json(res, 401, { error: "not_signed_in", message: "Please sign in first." });

    let body;
    try { body = await readJson(req); } catch (err) { return badBody(req, res, err); }

    const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    const confirm = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (next !== confirm) {
      return json(res, 400, { error: "password_mismatch", field: "confirmPassword", message: "The two passwords do not match." });
    }
    const weak = checkPassword(next, { email: session.email, fullName: session.full_name });
    if (weak) return json(res, 400, { error: "weak_password", field: "newPassword", message: weak });

    const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [session.id]);
    if (!rows.length || !(await verifyPassword(current, rows[0].password_hash))) {
      return json(res, 401, { error: "bad_password", field: "currentPassword", message: "Your current password is not correct." });
    }
    if (await verifyPassword(next, rows[0].password_hash)) {
      return json(res, 400, { error: "same_password", field: "newPassword", message: "Please choose a password you have not used here before." });
    }

    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [await hashPassword(next), session.id]);

    // Sign out everywhere else, keeping the session that made the change.
    const token = parseCookies(req)[SESSION_COOKIE];
    await query(`DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2`,
                [session.id, token ? hashToken(token) : ""]);

    return json(res, 200, { ok: true, message: "Your password has been changed. Any other devices have been signed out." });
  } catch (err) {
    if ((err.code === "NO_DATABASE" || err.code === "BAD_DATABASE_URL")) {
      return json(res, 503, { error: "not_configured", message: "The portal is not connected to a database yet." });
    }
    console.error("[password]", err);
    return json(res, 500, { error: "server_error", message: "Something went wrong. Please try again." });
  }
}
