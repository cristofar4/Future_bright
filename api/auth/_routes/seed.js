/* POST /api/auth/seed - load the sample register, timetable and results.
 *
 * Same reasoning as migrate: fixed SQL, additive only, and it refuses once the
 * register has anything in it, so it cannot overwrite a real school's data.
 */
import { query } from "../../_lib/db.js";
import { DEMO_REGISTER_SQL, DEMO_PORTAL_SQL } from "../../_lib/schema.js";
import { json, methodNotAllowed } from "../../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { rows } = await query(`SELECT count(*)::int AS n FROM register`);
    if (rows[0].n > 0) {
      return json(res, 409, {
        error: "not_empty",
        message: "The register already has entries, so the sample data was not loaded.",
      });
    }

    await query(DEMO_REGISTER_SQL);
    await query(DEMO_PORTAL_SQL);

    return json(res, 200, {
      ok: true,
      message: "Sample data loaded. Sign-up stays open, because demo rows are not a real register.",
    });
  } catch (err) {
    if (err.code === "NO_DATABASE") {
      return json(res, 503, { error: "not_configured", message: "No database is attached yet." });
    }
    if (err.code === "42P01") {           // undefined_table
      return json(res, 409, { error: "no_schema", message: "Create the tables first." });
    }
    console.error("[seed]", err);
    return json(res, 500, { error: "server_error", message: "The sample data could not be loaded." });
  }
}
