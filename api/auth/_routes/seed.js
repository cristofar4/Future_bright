/* POST /api/auth/seed - load the sample register, timetable and results.
 *
 * Same reasoning as migrate: fixed SQL, and it refuses once a real register has
 * been imported, so it cannot overwrite a school's own data.
 *
 * The test is on imported rows, not on the register being empty. Creating an
 * account while sign-up is open puts a row in the register, and guarding on
 * "empty" meant the first person through the door locked the sample data
 * behind them: they land on a dashboard with nothing on it and the one button
 * that would fill it refuses. Rows a sign-up created are not a school's data.
 */
import { query } from "../../_lib/db.js";
import { DEMO_REGISTER_SQL, DEMO_PORTAL_SQL } from "../../_lib/schema.js";
import { json, methodNotAllowed } from "../../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { rows } = await query(
      `SELECT EXISTS (
         SELECT 1 FROM register       WHERE source = 'import'
         UNION ALL
         SELECT 1 FROM staff_register WHERE source = 'import'
       ) AS imported`
    );
    if (rows[0].imported) {
      return json(res, 409, {
        error: "register_imported",
        message: "The school register has been imported, so the sample data was not loaded.",
      });
    }

    await query(DEMO_REGISTER_SQL);
    await query(DEMO_PORTAL_SQL);

    return json(res, 200, {
      ok: true,
      message: "Sample data loaded. Reload this page, then open your dashboard to see it.",
    });
  } catch (err) {
    if ((err.code === "NO_DATABASE" || err.code === "BAD_DATABASE_URL")) {
      return json(res, 503, { error: "not_configured", message: "No database is attached yet." });
    }
    if (err.code === "42P01") {           // undefined_table
      return json(res, 409, { error: "no_schema", message: "Create the tables first." });
    }
    console.error("[seed]", err);
    return json(res, 500, { error: "server_error", message: "The sample data could not be loaded." });
  }
}
