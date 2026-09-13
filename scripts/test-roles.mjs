/* End-to-end tests for the parent, teacher and administrator dashboards.
 *   DATABASE_URL=postgres://... node scripts/test-roles.mjs
 * Self-contained: it clears the portal tables and reloads both demo fixtures,
 * so it passes whatever else has run before it.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { query, closePool } from "../api/_lib/db.js";

const here = dirname(fileURLToPath(import.meta.url));
const db = (name) => readFile(join(here, "..", "db", name), "utf8");

await query(`TRUNCATE sessions, auth_attempts, users, register, staff_register,
                      subject_results, attendance, assignment_submissions, messages,
                      timetable, assignments, announcements, subjects, terms
             RESTART IDENTITY CASCADE`);
await query(await db("demo-register.sql"));
await query(await db("demo-portal.sql"));

const authRoute   = (await import("../api/auth/[action].js")).default;
const portalRoute = (await import("../api/portal/[section].js")).default;

let pass = 0, fail = 0; const failures = [];
const check = (n, ok, d = "") => ok
  ? (pass++, console.log(`  PASS  ${n}`))
  : (fail++, failures.push(n), console.log(`  FAIL  ${n}${d ? " - " + d : ""}`));

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const route = pathname.startsWith("/api/auth/") ? authRoute
              : pathname.startsWith("/api/portal/") ? portalRoute : null;
  if (!route) { res.statusCode = 404; return res.end("{}"); }
  try { await route(req, res); } catch (e) { console.error(e); res.statusCode = 500; res.end("{}"); }
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
const signup = (body) => call("/api/auth/signup", { method: "POST", body: { ...body, password: PW, confirmPassword: PW } });

/* ---------------------------------------------------------------------------
   The first staff account on a site with no administrator becomes one.
   Everything below depends on this running first, so it is tested first.
--------------------------------------------------------------------------- */
console.log("\nthe first member of staff becomes the administrator");

// A pupil signing up first must not be handed the whole school's records.
const earlyPupil = await signup({
  role: "student", fullName: "Chidera Okafor", email: "chidera@example.com",
  phone: "08011112222", reference: "BFS/2025/0142", classLevel: "SS2",
});
check("a pupil can sign up first", earlyPupil.status === 201, `${earlyPupil.status} ${earlyPupil.body.message || ""}`);
check("but a pupil is never the bootstrap administrator", earlyPupil.body.user?.isAdmin === false,
  JSON.stringify(earlyPupil.body.user));
{
  const r = await call("/api/portal/admin", { cookie: earlyPupil.cookie });
  check("and cannot open the admin view", r.status === 403, String(r.status));
}

// Folake Ogun is BFS/STF/014 in the demo staff register, with an email on file.
const admin = await signup({
  role: "teacher", fullName: "Dr. Folake Ogun", email: "folake.ogun@brightfuture.edu.ng",
  phone: "08050001111", reference: "BFS/STF/014",
});
check("administrator signed up", admin.status === 201, `${admin.status} ${admin.body.message || ""}`);
check("flagged as an administrator", admin.body.user?.isAdmin === true, JSON.stringify(admin.body.user));

// Samuel Ibrahim is BFS/STF/022, and "Mrs. Ibrahim" teaches on the demo timetable.
const teacher = await signup({
  role: "teacher", fullName: "Samuel Ibrahim", email: "s.ibrahim@brightfuture.edu.ng",
  phone: "08050002222", reference: "BFS/STF/022",
});
check("second member of staff signed up", teacher.status === 201, `${teacher.status} ${teacher.body.message || ""}`);
check("the second account is not an administrator", teacher.body.user?.isAdmin === false);

// Daniel's guardian, reaching us on the email the school already holds.
const parent = await signup({
  role: "parent", fullName: "Ada James", email: "mrs.james@example.com",
  phone: "+234 806 222 3344", reference: "BFS/2024/0178", classLevel: "SS2",
});
check("parent signed up", parent.status === 201, `${parent.status} ${parent.body.message || ""}`);

const pupil = await signup({
  role: "student", fullName: "Daniel James", email: "daniel@example.com",
  phone: "08012223344", reference: "BFS/2024/0178", classLevel: "SS2",
});
check("the pupil signed up", pupil.status === 201, `${pupil.status} ${pupil.body.message || ""}`);

/* ------------------------------------------------------------------ parent */
console.log("\nparent dashboard");
{
  const r = await call("/api/portal/parent", { cookie: parent.cookie });
  check("loads for a parent", r.status === 200, `${r.status} ${r.body.message || ""}`);
  const d = r.body;

  check("headed by the parent, not the child", d.parent?.fullName === "Ada James", d.parent?.fullName);
  check("parent initials derived", d.parent?.initials === "AJ", d.parent?.initials);
  check("parent greeted by name, not by title", d.parent?.firstName === "Ada", d.parent?.firstName);
  check("the child is the one the school linked", d.child?.fullName === "Daniel James", d.child?.fullName);
  check("child's class shows the arm", d.child?.className === "SS2A", d.child?.className);
  check("child's admission number shown", d.child?.admissionNo === "BFS/2024/0178", d.child?.admissionNo);

  check("term resolved", d.term?.label === "Second Term", JSON.stringify(d.term));
  check("the child's day is listed", d.today?.length === 5, `${d.today?.length}`);
  check("results are the child's", d.results?.length === 5, `${d.results?.length}`);
  check("average is a whole number", Number.isInteger(d.average) && d.average > 0, `${d.average}`);
  check("attendance counted", d.attendance?.total > 0 && d.attendance.percent > 0, JSON.stringify(d.attendance));
  check("homework listed", d.assignments?.length === 4, `${d.assignments?.length}`);
  check("outstanding work counted",
    d.outstanding === d.assignments.filter((a) => !a.submitted).length, `${d.outstanding}`);
  check("announcements for parents", Array.isArray(d.announcements) && d.announcements.length > 0);

  const post = await call("/api/portal/parent", { method: "POST", cookie: parent.cookie });
  check("POST is rejected", post.status === 405, String(post.status));
}

/* ----------------------------------------------------------------- teacher */
console.log("\nteacher dashboard");
{
  const r = await call("/api/portal/teacher", { cookie: teacher.cookie });
  check("loads for a teacher", r.status === 200, `${r.status} ${r.body.message || ""}`);
  const d = r.body;

  check("staff number shown", d.teacher?.staffNo === "BFS/STF/022", d.teacher?.staffNo);
  check("teacher named", d.teacher?.fullName === "Samuel Ibrahim", d.teacher?.fullName);
  check("their own periods are found", d.totals?.lessonsPerWeek > 0, JSON.stringify(d.totals));
  check("lessons carry the class they are with",
    d.today.every((l) => typeof l.class_name === "string" && l.class_name.length > 0),
    JSON.stringify(d.today?.[0] || {}));
  check("classes listed with pupil counts",
    d.classes?.length > 0 && d.classes.every((c) => Number.isInteger(c.pupils)),
    JSON.stringify(d.classes));
  check("class total is the sum of its classes",
    d.totals.pupils === d.classes.reduce((n, c) => n + c.pupils, 0), `${d.totals.pupils}`);
  check("only their own subjects counted", d.totals.subjects > 0 && d.totals.subjects <= 6, `${d.totals.subjects}`);
  check("staff announcements returned", Array.isArray(d.announcements));

  // The administrator teaches nothing on the demo timetable, so their own
  // teacher view is empty rather than showing someone else's classes.
  const mine = await call("/api/portal/teacher", { cookie: admin.cookie });
  check("a teacher with no periods gets an empty day, not everyone's",
    mine.status === 200 && mine.body.today.length === 0 && mine.body.classes.length === 0,
    `${mine.status} ${mine.body.today?.length}/${mine.body.classes?.length}`);

  const post = await call("/api/portal/teacher", { method: "POST", cookie: teacher.cookie });
  check("POST is rejected", post.status === 405, String(post.status));
}

/* ------------------------------------------------------------------- admin */
console.log("\nadmin dashboard");
{
  const r = await call("/api/portal/admin", { cookie: admin.cookie });
  check("loads for an administrator", r.status === 200, `${r.status} ${r.body.message || ""}`);
  const d = r.body;

  check("administrator named", d.admin?.fullName === "Dr. Folake Ogun", d.admin?.fullName);
  check("a title is not mistaken for a first name", d.admin?.firstName === "Folake", d.admin?.firstName);
  check("initials skip the title too", d.admin?.initials === "FO", d.admin?.initials);
  check("marked as an administrator", d.admin?.isAdmin === true);
  check("pupils counted", d.totals?.pupils > 0, `${d.totals?.pupils}`);
  check("staff counted", d.totals?.staff >= 2, `${d.totals?.staff}`);
  check("accounts counted", d.totals?.accounts === 5, `${d.totals?.accounts}`);
  check("accounts broken down by role",
    d.totals.student_accounts === 2 && d.totals.parent_accounts === 1 && d.totals.teacher_accounts === 2,
    JSON.stringify(d.totals));
  check("sessions counted", d.totals?.active_sessions >= 5, `${d.totals?.active_sessions}`);
  check("pupils grouped by class",
    d.byClass?.length > 0 && d.byClass.every((c) => c.class_name && Number.isInteger(c.pupils)),
    JSON.stringify(d.byClass));
  check("class totals add up to the roll",
    d.byClass.reduce((n, c) => n + c.pupils, 0) === d.totals.pupils);
  check("newest accounts listed", d.recentAccounts?.length === 5, `${d.recentAccounts?.length}`);
  check("newest first",
    new Date(d.recentAccounts[0].created_at) >= new Date(d.recentAccounts[4].created_at));
  check("the administrator is marked as one",
    d.recentAccounts.filter((a) => a.is_admin).length === 1);

  // Nothing on this page may carry a credential.
  const serialised = JSON.stringify(d);
  check("no password hash anywhere in the payload", !/password|scrypt|\$2[aby]\$/i.test(serialised));
  check("no session token anywhere in the payload", !/token|session_hash/i.test(serialised));
  check("account rows carry names and roles only",
    d.recentAccounts.every((a) => Object.keys(a).sort().join(",") === "created_at,email,full_name,is_admin,role"),
    Object.keys(d.recentAccounts[0]).join(","));

  check("register sources reported", Array.isArray(d.register?.sources));
  check("demo rows leave sign-up open", d.register?.openSignup === true, JSON.stringify(d.register));
  check("nothing has been imported yet", d.register?.imported === 0, `${d.register?.imported}`);

  // An administrator is still a teacher, so their own dashboard says so and
  // the admin view is reached from a link there rather than by redirect.
  const own = await call("/api/portal/teacher", { cookie: admin.cookie });
  check("an administrator's own dashboard knows they are one", own.body.teacher?.isAdmin === true);
  const plain = await call("/api/portal/teacher", { cookie: teacher.cookie });
  check("an ordinary teacher is not offered the admin view", plain.body.teacher?.isAdmin === false);

  const post = await call("/api/portal/admin", { method: "POST", cookie: admin.cookie });
  check("POST is rejected", post.status === 405, String(post.status));
}

/* ------------------------------------------------- one dashboard per person */
console.log("\neach role stays on its own dashboard");
{
  const cases = [
    ["a parent cannot open the teacher view",   "/api/portal/teacher", parent,  "parent.html"],
    ["a parent cannot open the admin view",     "/api/portal/admin",   parent,  "parent.html"],
    ["a parent cannot open a pupil dashboard",  "/api/portal/dashboard", parent, "parent.html"],
    ["a teacher cannot open the parent view",   "/api/portal/parent",  teacher, "teacher.html"],
    ["a teacher is not an administrator",       "/api/portal/admin",   teacher, "teacher.html"],
    ["a pupil cannot open the parent view",     "/api/portal/parent",  pupil,   "portal.html"],
    ["a pupil cannot open the teacher view",    "/api/portal/teacher", pupil,   "portal.html"],
    ["a pupil cannot open the admin view",      "/api/portal/admin",   pupil,   "portal.html"],
    ["an administrator is not a parent",        "/api/portal/parent",  admin,   "teacher.html"],
  ];
  for (const [name, path, who, home] of cases) {
    const r = await call(path, { cookie: who.cookie });
    check(name, r.status === 403, `${r.status} ${r.body.message || ""}`);
    check(`${name}: pointed at their own dashboard`, r.body.home === home, r.body.home);
  }

  for (const path of ["/api/portal/parent", "/api/portal/teacher", "/api/portal/admin"]) {
    const r = await call(path);
    check(`${path} needs a sign-in`, r.status === 401, String(r.status));
  }
}

/* -------------------------------------------------------------------- demo */
console.log("\ndemo preview, with no sign-in");
{
  for (const [section, key] of [["parent", "child"], ["teacher", "classes"], ["admin", "totals"]]) {
    const r = await call(`/api/portal/demo?section=${section}`);
    check(`${section} preview loads`, r.status === 200, String(r.status));
    check(`${section} preview is labelled a demo`, r.body.demo === true);
    check(`${section} preview carries its own data`, r.body[section] && r.body[key],
      Object.keys(r.body).join(","));
  }
  const bad = await call("/api/portal/demo?section=nonsense");
  check("an unknown preview section is refused", bad.status === 400, String(bad.status));
}

/* ------------------------------------------- finding the connection string */
console.log("\nwhere the connection string is read from");
{
  const { databaseUrlVar } = await import("../api/_lib/db.js");
  const saved = { ...process.env };
  const clear = () => ["DATABASE_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED",
                       "POSTGRES_URL_NON_POOLING"].forEach((k) => delete process.env[k]);

  clear();
  check("nothing set means no database", databaseUrlVar() === null, String(databaseUrlVar()));

  // Vercel's own Postgres, and the Supabase integration, set POSTGRES_URL when
  // you connect a database to a project. Taking only DATABASE_URL would look
  // to the person clicking through as if their database had been ignored.
  clear();
  process.env.POSTGRES_URL = "postgres://x@y/z";
  check("POSTGRES_URL is accepted", databaseUrlVar() === "POSTGRES_URL", String(databaseUrlVar()));

  clear();
  process.env.POSTGRES_URL_NON_POOLING = "postgres://x@y/z";
  check("POSTGRES_URL_NON_POOLING is accepted",
    databaseUrlVar() === "POSTGRES_URL_NON_POOLING", String(databaseUrlVar()));

  clear();
  process.env.DATABASE_URL = "postgres://a@b/c";
  process.env.POSTGRES_URL = "postgres://x@y/z";
  check("DATABASE_URL wins when both are set", databaseUrlVar() === "DATABASE_URL", String(databaseUrlVar()));

  clear();
  process.env.DATABASE_URL = "   ";
  process.env.POSTGRES_URL = "postgres://x@y/z";
  check("an empty variable is not mistaken for one that is set",
    databaseUrlVar() === "POSTGRES_URL", String(databaseUrlVar()));

  clear();
  Object.assign(process.env, saved);
}

/* ------------------------------------------- a connection string pg cannot use */
console.log("\na proxy connection string is named as the problem");
{
  const { isDirectPostgresUrl } = await import("../api/_lib/db.js");
  const direct = [
    "postgres://u:p@host/db",
    "postgresql://u:p@host/db?sslmode=require",
    "POSTGRESQL://u:p@host/db",
    "/var/run/postgresql",
  ];
  direct.forEach((u) => check(`accepted: ${u.slice(0, 34)}`, isDirectPostgresUrl(u) === true));

  // Prisma Postgres hands out an Accelerate URL that only the Prisma client can
  // open. Treating it as a dead host would send someone hunting a firewall.
  const proxied = [
    "prisma+postgres://accelerate.prisma-data.net/?api_key=ey",
    "prisma://accelerate.prisma-data.net/?api_key=ey",
    "mysql://u:p@host/db",
    "",
  ];
  proxied.forEach((u) => check(`refused: ${u.slice(0, 34) || "(empty)"}`, isDirectPostgresUrl(u) === false));
}

const mode = await call("/api/auth/mode");
check("mode names the variable it read", mode.body.databaseUrlVar === "DATABASE_URL",
  String(mode.body.databaseUrlVar));
check("mode never echoes the connection string itself",
  !JSON.stringify(mode.body).includes("postgres"), JSON.stringify(mode.body));

server.close();
await closePool();
console.log(`\n${pass} passed, ${fail} failed`);
failures.forEach((f) => console.log("  -", f));
process.exit(fail ? 1 : 0);
