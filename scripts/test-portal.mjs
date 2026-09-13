/* End-to-end tests for the student dashboard API.
 *   DATABASE_URL=postgres://... node scripts/test-portal.mjs
 * Needs db/schema.sql and db/portal-schema.sql applied; the demo fixture is
 * loaded by the test itself, so it can run in any order.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { query, closePool } from "../api/_lib/db.js";

// Load the demo fixture rather than assuming a previous command left it in
// place: the auth suite truncates the register, so this must stand alone.
const here = dirname(fileURLToPath(import.meta.url));
await query(await readFile(join(here, "..", "db", "demo-portal.sql"), "utf8"));

const handlers = {
  "/api/auth/signup":      (await import("../api/auth/signup.js")).default,
  "/api/auth/login":       (await import("../api/auth/login.js")).default,
  "/api/portal/dashboard": (await import("../api/portal/dashboard.js")).default,
};

let pass = 0, fail = 0; const failures = [];
const check = (n, ok, d = "") => ok
  ? (pass++, console.log(`  PASS  ${n}`))
  : (fail++, failures.push(n), console.log(`  FAIL  ${n}${d ? " - " + d : ""}`));

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const h = handlers[pathname];
  if (!h) { res.statusCode = 404; return res.end("{}"); }
  try { await h(req, res); } catch (e) { console.error(e); res.statusCode = 500; res.end("{}"); }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

async function call(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: json || {}, cookie: (res.headers.get("set-cookie") || "").split(";")[0] };
}

const PW = "korrect-horse-9021";

await query("TRUNCATE sessions, auth_attempts, users RESTART IDENTITY CASCADE");

// Daniel James, the pupil in the dashboard design.
const daniel = await call("/api/auth/signup", { method: "POST", body: {
  role: "student", fullName: "Daniel James", email: "daniel@example.com", phone: "08012223344",
  reference: "BFS/2024/0178", classLevel: "SS2", password: PW, confirmPassword: PW } });

// Messages hang off the user row, which the truncate above removed, so seed
// them against the account this test just created.
await query(
  `INSERT INTO messages (user_id, sender, subject, body, read_at)
   SELECT u.id, v.sender, 'Subject', 'Body', NULL
     FROM users u
     JOIN register r ON r.id = u.register_id
     CROSS JOIN (VALUES ('Mr. Okafor'), ('Mrs. Bello'), ('School Office')) AS v(sender)
    WHERE upper(replace(r.admission_no, ' ', '')) = 'BFS/2024/0178'`
);

console.log("\ndashboard for a signed-in student");
{
  check("setup signup succeeded", daniel.status === 201, `${daniel.status} ${daniel.body.message || ""}`);

  const r = await call("/api/portal/dashboard", { cookie: daniel.cookie });
  check("dashboard loads", r.status === 200, String(r.status));
  const d = r.body;

  check("student identified", d.student.fullName === "Daniel James" && d.student.admissionNo === "BFS/2024/0178");
  check("class shows the arm", d.student.className === "SS2A", d.student?.className);
  check("initials derived", d.student.initials === "DJ", d.student?.initials);
  check("greeting present", ["Good Morning", "Good Afternoon", "Good Evening"].includes(d.greeting), d.greeting);

  check("current term resolved", Boolean(d.term) && d.term.label === "Second Term", JSON.stringify(d.term));
  check("days left is a non-negative number", Number.isInteger(d.term.daysLeft) && d.term.daysLeft >= 0);

  check("timetable has the day's lessons", d.today.length === 5, `${d.today.length}`);
  check("lessons are in time order",
    d.today.every((l, i) => i === 0 || l.starts_at_24 > d.today[i - 1].starts_at_24),
    d.today.map((l) => l.starts_at_24).join(" "));
  check("lesson carries teacher and room", d.today[0].teacher === "Mr. Okafor" && d.today[0].room === "Room 12");

  check("assignments returned", d.assignments.length === 4, `${d.assignments.length}`);
  check("submitted work is marked submitted",
    d.assignments.find((a) => a.title === "Mathematics Homework")?.submitted === true);
  check("unsubmitted work is not",
    d.assignments.find((a) => a.title === "English Essay")?.submitted === false);

  check("results returned", d.results.length === 5, `${d.results.length}`);
  const mean = Math.round(d.results.reduce((s, x) => s + x.score, 0) / d.results.length);
  check("average matches the results", d.average === mean, `${d.average} vs ${mean}`);

  check("attendance counted", d.attendance.present === 46 && d.attendance.absent === 2 && d.attendance.late === 1,
    JSON.stringify(d.attendance));
  check("attendance percent matches the counts",
    d.attendance.percent === Math.round((d.attendance.present / d.attendance.total) * 100));

  check("announcements returned", d.announcements.length > 0);
  check("unread message count", d.unreadMessages === 3, String(d.unreadMessages));
  check("no password hash anywhere in the payload", !JSON.stringify(d).toLowerCase().includes("scrypt"));
}

console.log("\naccess control");
{
  let r = await call("/api/portal/dashboard");
  check("no cookie is 401", r.status === 401, String(r.status));

  r = await call("/api/portal/dashboard", { cookie: "bfss_session=forged-value-here" });
  check("forged cookie is 401", r.status === 401, String(r.status));

  r = await call("/api/portal/dashboard", { method: "POST", cookie: daniel.cookie });
  check("POST is rejected", r.status === 405, String(r.status));

  // A second pupil must not see Daniel's record.
  const other = await call("/api/auth/signup", { method: "POST", body: {
    role: "student", fullName: "Chidera Okafor", email: "chidera@example.com", phone: "08011112222",
    reference: "BFS/2025/0142", classLevel: "SS2", password: PW, confirmPassword: PW } });
  check("second pupil signed up", other.status === 201, `${other.status} ${other.body.message || ""}`);

  r = await call("/api/portal/dashboard", { cookie: other.cookie });
  check("second pupil sees their own record", r.status === 200 && r.body.student.admissionNo === "BFS/2025/0142",
    r.body?.student?.admissionNo);
  check("second pupil sees none of Daniel's results", r.body.results.length === 0, `${r.body?.results?.length}`);
  check("second pupil sees none of Daniel's attendance", r.body.attendance.total === 0);
  check("second pupil has no unread messages", r.body.unreadMessages === 0);

  // A parent account is a different portal.
  const parent = await call("/api/auth/signup", { method: "POST", body: {
    role: "parent", fullName: "Amaka Okafor", email: "amaka.okafor@example.com", phone: "08099998888",
    reference: "BFS/2025/0142", classLevel: "SS2", password: PW, confirmPassword: PW } });
  check("parent signed up", parent.status === 201, `${parent.status} ${parent.body.message || ""}`);
  r = await call("/api/portal/dashboard", { cookie: parent.cookie });
  check("parent gets 403, not another pupil's dashboard", r.status === 403, String(r.status));
}

server.close();
await closePool();
console.log(`\n${pass} passed, ${fail} failed`);
failures.forEach((f) => console.log("  -", f));
process.exit(fail ? 1 : 0);
