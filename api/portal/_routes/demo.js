/* GET /api/portal/demo?section=dashboard
 *
 * The sample student, with no database and no sign-in. Everything it returns
 * carries demo: true, and the interface labels the page as a preview.
 */
import { json, methodNotAllowed } from "../../_lib/http.js";
import { demoPayload } from "../_demo.js";

const SECTIONS = ["dashboard", "classes", "assignments", "results", "attendance",
                  "messages", "profile", "calendar", "parent", "teacher", "admin",
                  "pupils", "staff", "announcements"];

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const url = new URL(req.url, "http://localhost");
  const section = String(url.searchParams.get("section") || "dashboard");
  if (!SECTIONS.includes(section)) {
    return json(res, 400, { error: "unknown_section", message: "No such section." });
  }
  return json(res, 200, demoPayload(section));
}
