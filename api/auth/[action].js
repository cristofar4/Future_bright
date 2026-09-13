/* One Serverless Function for every /api/auth/* route.
 *
 * Vercel's Hobby plan allows 12 Serverless Functions per deployment, and a file
 * per endpoint took the site past that. A dynamic route collapses them into one
 * without changing a single URL. It also means one database pool for the whole
 * group rather than one per endpoint, which matters on a small Postgres plan.
 *
 * The handlers live in _routes/, which Vercel does not turn into functions
 * because the directory starts with an underscore.
 */
import login  from "./_routes/login.js";
import logout from "./_routes/logout.js";
import me     from "./_routes/me.js";
import mode   from "./_routes/mode.js";
import signup from "./_routes/signup.js";

import { json } from "../_lib/http.js";

const ROUTES = { login, logout, me, mode, signup };

export default async function handler(req, res) {
  // Taken from the path rather than req.query, so this behaves identically
  // under Vercel, the local dev server and the tests.
  const { pathname } = new URL(req.url, "http://localhost");
  const action = pathname.split("/").filter(Boolean).pop();

  const route = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : null;
  if (!route) {
    return json(res, 404, { error: "not_found", message: "No such endpoint." });
  }
  return route(req, res);
}
