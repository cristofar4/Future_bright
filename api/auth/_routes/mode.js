/* GET /api/auth/mode
 *
 * What state the portal is in. The sign-up page uses it to say what to expect,
 * and setup.html turns it into a checklist.
 *
 * Deliberately says nothing about who is on the register and never echoes a
 * connection string or a raw driver error, only a category.
 */
import { query } from "../../_lib/db.js";
import { json, methodNotAllowed } from "../../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  // Reached at all, so the functions are deployed.
  const state = {
    api: true,
    database: false,     // DATABASE_URL set and a query succeeded
    schema: false,       // tables created
    registerImported: false,
    openSignup: false,
    configured: false,   // kept for the sign-up page
    stage: "database",   // which step to do next
  };

  if (!process.env.DATABASE_URL) {
    state.stage = "database";
    return json(res, 200, state);
  }

  try {
    // Cheap connectivity check that does not assume any table exists.
    await query("SELECT 1");
    state.database = true;
  } catch (err) {
    // Never pass the driver message through: it can contain the host and user.
    console.error("[mode] database unreachable:", err.message);
    state.stage = "connection";
    return json(res, 200, state);
  }

  try {
    const { rows } = await query(
      `SELECT
         EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'users') AS has_users,
         EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'register') AS has_register`
    );
    state.schema = rows[0].has_users && rows[0].has_register;
  } catch (err) {
    console.error("[mode] schema check failed:", err.message);
  }

  if (!state.schema) {
    state.stage = "schema";
    return json(res, 200, state);
  }

  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM register       WHERE status = 'active' AND source = 'import'
       UNION ALL
       SELECT 1 FROM staff_register WHERE status = 'active' AND source = 'import'
     ) AS imported`
  );
  state.registerImported = rows[0].imported;

  const flag = String(process.env.PORTAL_OPEN_SIGNUP || "").toLowerCase();
  state.openSignup = flag === "true" || flag === "1" ? true
                   : flag === "false" || flag === "0" ? false
                   : !state.registerImported;

  state.configured = true;
  state.stage = "ready";
  return json(res, 200, state);
}
