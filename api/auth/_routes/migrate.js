/* POST /api/auth/migrate - create the portal tables.
 *
 * Exists so the site can be set up from a phone, with no terminal. It is safe
 * to expose because of three properties:
 *
 *   - the SQL is fixed and shipped with the function; nothing from the request
 *     reaches the database
 *   - every statement is CREATE ... IF NOT EXISTS or ADD COLUMN IF NOT EXISTS,
 *     so it only ever adds and never drops or alters existing data
 *   - it refuses once the tables exist, so it is a first-run action only
 */
import { query } from "../../_lib/db.js";
import { SCHEMA_SQL, PORTAL_SQL } from "../../_lib/schema.js";
import { json, methodNotAllowed } from "../../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { rows } = await query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                       WHERE table_schema = 'public' AND table_name = 'users') AS done`
    );
    if (rows[0].done) {
      return json(res, 409, {
        error: "already_done",
        message: "The tables already exist. Nothing to do.",
      });
    }

    await query(SCHEMA_SQL);
    await query(PORTAL_SQL);

    return json(res, 200, { ok: true, message: "Tables created. You can create an account now." });
  } catch (err) {
    if (err.code === "NO_DATABASE") {
      return json(res, 503, {
        error: "not_configured",
        message: "No database is attached yet. Set DATABASE_URL in Vercel first, then redeploy.",
      });
    }
    console.error("[migrate]", err);
    return json(res, 500, {
      error: "server_error",
      message: "The tables could not be created. Check the database user is allowed to create tables.",
    });
  }
}
