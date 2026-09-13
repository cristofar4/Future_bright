/* One Serverless Function for every /api/portal/* route. See the note in
 * api/auth/[action].js for why these are collapsed. */
import assignments from "./_routes/assignments.js";
import attendance  from "./_routes/attendance.js";
import classes     from "./_routes/classes.js";
import dashboard   from "./_routes/dashboard.js";
import demo        from "./_routes/demo.js";
import messages    from "./_routes/messages.js";
import password    from "./_routes/password.js";
import profile     from "./_routes/profile.js";
import results     from "./_routes/results.js";

import { json } from "../_lib/http.js";

const ROUTES = { assignments, attendance, classes, dashboard, demo, messages, password, profile, results };

export default async function handler(req, res) {
  const { pathname } = new URL(req.url, "http://localhost");
  const section = pathname.split("/").filter(Boolean).pop();

  const route = Object.prototype.hasOwnProperty.call(ROUTES, section) ? ROUTES[section] : null;
  if (!route) {
    return json(res, 404, { error: "not_found", message: "No such endpoint." });
  }
  return route(req, res);
}
