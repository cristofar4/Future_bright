/* GET /api/auth/me - who the current cookie belongs to, if anyone. */
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSessionUser, publicUser } from "../../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const row = await getSessionUser(req);
    if (!row) return json(res, 401, { error: "not_signed_in", message: "Not signed in." });
    return json(res, 200, { user: publicUser(row) });
  } catch (err) {
    if (err.code === "NO_DATABASE") {
      return json(res, 503, { error: "not_configured", message: "The portal is not available yet." });
    }
    console.error("[me]", err);
    return json(res, 500, { error: "server_error", message: "Something went wrong." });
  }
}
