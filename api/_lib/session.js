/* Creating, reading and revoking portal sessions. */
import { query } from "./db.js";
import { newSessionToken, hashToken } from "./crypto.js";
import { SESSION_DAYS, SESSION_COOKIE, parseCookies } from "./http.js";

export async function createSession(userId, userAgent) {
  const token = newSessionToken();
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, user_agent)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4)`,
    [hashToken(token), userId, String(SESSION_DAYS), String(userAgent || "").slice(0, 300)]
  );
  return token;                       // the raw token is only ever returned here
}

/** Resolve the cookie on a request to a user, or null. */
export async function getSessionUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const { rows } = await query(
    `SELECT u.id, u.role, u.full_name, u.email, u.phone, u.last_login_at,
            r.admission_no, r.class_level, s.staff_no
       FROM sessions sess
       JOIN users u          ON u.id = sess.user_id
       LEFT JOIN register r  ON r.id = u.register_id
       LEFT JOIN staff_register s ON s.id = u.staff_id
      WHERE sess.token_hash = $1
        AND sess.expires_at > now()`,
    [hashToken(token)]
  );
  return rows[0] || null;
}

export async function destroySession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return;
  await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}

/** Drop expired rows. Cheap, and keeps the table honest. */
export async function pruneSessions() {
  await query(`DELETE FROM sessions WHERE expires_at < now()`);
}

/** Shape a user row for the browser. Never includes the password hash. */
export function publicUser(row) {
  return {
    id: String(row.id),
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || null,
    admissionNo: row.admission_no || null,
    classLevel: row.class_level || null,
    staffNo: row.staff_no || null,
  };
}
