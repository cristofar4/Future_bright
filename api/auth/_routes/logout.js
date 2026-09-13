/* POST /api/auth/logout - revokes the session server-side and clears the cookie. */
import { json, methodNotAllowed, clearSessionCookie } from "../../_lib/http.js";
import { destroySession } from "../../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    await destroySession(req);
  } catch (err) {
    // Clearing the cookie still matters even if the delete failed.
    if (err.code !== "NO_DATABASE") console.error("[logout]", err);
  }
  clearSessionCookie(req, res);
  return json(res, 200, { ok: true });
}
