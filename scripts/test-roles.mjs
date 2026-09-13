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

/* --------------------------------------------------------- the roll and staff */
console.log("\nthe roll");
{
  const r = await call("/api/portal/pupils", { cookie: admin.cookie });
  check("loads for an administrator", r.status === 200, `${r.status} ${r.body.message || ""}`);
  const d = r.body;

  check("pupils are listed", d.pupils?.length > 0, `${d.pupils?.length}`);
  check("a row carries what the list shows",
    d.pupils.every((p) => p.id && p.admissionNo && p.fullName && p.className),
    JSON.stringify(d.pupils[0]));
  check("classes are offered as filters", d.classes?.length > 0);
  check("totals are counted", Number.isInteger(d.totals?.active) && d.totals.active > 0);
  check("paging is reported", d.page === 1 && d.pages >= 1 && d.perPage === 25);
  check("only pupils on the register by default", d.filters.status === "active");

  // Nothing on this page may carry a credential.
  const serialised = JSON.stringify(d);
  check("no password hash in the roll", !/password|scrypt|\$2[aby]\$/i.test(serialised));
  check("no session token in the roll", !/token|session_hash/i.test(serialised));

  const byClass = await call(`/api/portal/pupils?class=${encodeURIComponent(d.classes[0].class_name)}`,
    { cookie: admin.cookie });
  check("filtering by class returns only that class",
    byClass.body.pupils.every((p) => p.className === d.classes[0].class_name),
    byClass.body.pupils.map((p) => p.className).join(" "));

  const found = await call("/api/portal/pupils?q=James", { cookie: admin.cookie });
  check("search finds by surname",
    found.body.pupils.some((p) => p.fullName.includes("James")),
    found.body.pupils.map((p) => p.fullName).join(", "));

  const none = await call("/api/portal/pupils?q=zzzznobody", { cookie: admin.cookie });
  check("a search with no matches is empty, not an error",
    none.status === 200 && none.body.pupils.length === 0);

  // A search term is a parameter, never concatenated into the SQL.
  const nasty = await call("/api/portal/pupils?q=" + encodeURIComponent("%' OR 1=1 --"),
    { cookie: admin.cookie });
  check("a search term cannot break out of the query",
    nasty.status === 200 && nasty.body.pupils.length === 0, `${nasty.status} ${nasty.body.pupils?.length}`);

  const one = await call(`/api/portal/pupils?id=${d.pupils[0].id}`, { cookie: admin.cookie });
  check("one pupil's record loads", one.status === 200, `${one.status}`);
  check("it is the pupil asked for", one.body.pupil?.id === d.pupils[0].id);
  check("with their results", Array.isArray(one.body.results));
  check("their attendance", Number.isInteger(one.body.attendance?.total));
  check("their homework", Array.isArray(one.body.assignments));
  check("and the accounts linked to them", Array.isArray(one.body.accounts));
  check("account rows carry no credential",
    one.body.accounts.every((a) =>
      Object.keys(a).sort().join(",") === "created_at,email,full_name,last_login_at,phone,role"),
    Object.keys(one.body.accounts[0] || {}).join(","));

  const missing = await call("/api/portal/pupils?id=99999999", { cookie: admin.cookie });
  check("an id that is not there is a plain 404", missing.status === 404, `${missing.status}`);
  const silly = await call("/api/portal/pupils?id=not-a-number", { cookie: admin.cookie });
  check("a nonsense id is refused", silly.status === 400, `${silly.status}`);

  const post = await call("/api/portal/pupils", { method: "POST", cookie: admin.cookie });
  check("POST is rejected", post.status === 405, String(post.status));
}

console.log("\nthe staff register");
{
  const r = await call("/api/portal/staff", { cookie: admin.cookie });
  check("loads for an administrator", r.status === 200, `${r.status} ${r.body.message || ""}`);
  const d = r.body;

  check("staff are listed", d.staff?.length > 0, `${d.staff?.length}`);
  check("a row carries the staff number", d.staff.every((p) => p.staffNo && p.fullName));
  check("what they teach is counted", d.staff.every((p) => Number.isInteger(p.periods)));
  check("administrators are counted", Number.isInteger(d.totals?.admins) && d.totals.admins >= 1,
    `${d.totals?.admins}`);

  const serialised = JSON.stringify(d);
  check("no password hash in the staff list", !/password|scrypt|\$2[aby]\$/i.test(serialised));
  check("no session token in the staff list", !/token|session_hash/i.test(serialised));

  const found = await call("/api/portal/staff?q=Ibrahim", { cookie: admin.cookie });
  check("search finds by surname",
    found.body.staff.some((p) => p.fullName.includes("Ibrahim")),
    found.body.staff.map((p) => p.fullName).join(", "));

  const one = await call(`/api/portal/staff?id=${d.staff[0].id}`, { cookie: admin.cookie });
  check("one member of staff loads", one.status === 200 && one.body.staff?.id === d.staff[0].id);
  check("with the classes they take", Array.isArray(one.body.classes));
  check("and the accounts linked to them", Array.isArray(one.body.accounts));

  const post = await call("/api/portal/staff", { method: "POST", cookie: admin.cookie });
  check("POST is rejected", post.status === 405, String(post.status));
}

/* ---------------------------------------------------------- the notice board */
console.log("\nthe notice board");
{
  const post = (body) => call("/api/portal/announcements", { method: "POST", body, cookie: admin.cookie });
  const today = new Date().toISOString().slice(0, 10);
  const plus = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);

  let r = await call("/api/portal/announcements", { cookie: admin.cookie });
  check("the board loads for an administrator", r.status === 200, `${r.status} ${r.body.message || ""}`);
  check("notices are listed newest first",
    r.body.announcements.every((a, i, all) => i === 0 || a.published_on <= all[i - 1].published_on));
  check("the audiences on offer are the ones the column allows",
    JSON.stringify(r.body.audiences) === JSON.stringify(["all", "students", "parents", "staff"]));
  const started = r.body.totals.total;

  r = await post({ title: "Founders Day", body: "Parents are welcome from 10am.", audience: "parents" });
  check("a notice can be posted", r.status === 200 && r.body.ok === true, `${r.status} ${r.body.message || ""}`);
  check("it says it is up now", r.body.message.includes("on the board now"), r.body.message);
  check("the board comes back with it", r.body.totals.total === started + 1);
  const mine = r.body.announcements.find((a) => a.title === "Founders Day");
  check("posted to the audience given", mine?.audience === "parents", mine?.audience);
  check("dated today by default", String(mine?.published_on).slice(0, 10) === today,
    String(mine?.published_on));
  check("and credited to whoever wrote it", mine?.author === "Dr. Folake Ogun", mine?.author);
  check("not marked as scheduled", mine?.scheduled === false);

  // Only the audience it was written for should be able to see it.
  const onParentBoard = await call("/api/portal/parent", { cookie: parent.cookie });
  check("a parent sees a notice written for parents",
    onParentBoard.body.announcements.some((a) => a.title === "Founders Day"));
  const onPupilBoard = await call("/api/portal/dashboard", { cookie: pupil.cookie });
  check("a pupil does not", !onPupilBoard.body.announcements.some((a) => a.title === "Founders Day"));

  /* --- what it refuses ------------------------------------------------- */
  const bad = [
    [{ title: "Hi", body: "Long enough body here." }, "title", "a title under three characters"],
    [{ title: "A".repeat(121), body: "Long enough body here." }, "title", "a title over the limit"],
    [{ title: "A fine title", body: "x" }, "body", "an empty notice"],
    [{ title: "A fine title", body: "B".repeat(4001) }, "body", "a notice over the limit"],
    [{ title: "A fine title", body: "Long enough body here.", audience: "governors" }, "audience", "an audience that does not exist"],
    [{ title: "A fine title", body: "Long enough body here.", publishedOn: "13/09/2026" }, "publishedOn", "a date in the wrong shape"],
    [{ title: "A fine title", body: "Long enough body here.", publishedOn: "2026-02-31" }, "publishedOn", "a date that does not exist"],
  ];
  for (const [body, field, what] of bad) {
    const out = await post(body);
    check(`${what} is refused`, out.status === 400 && out.body.field === field,
      `${out.status} ${out.body.field || ""}`);
  }
  const after = await call("/api/portal/announcements", { cookie: admin.cookie });
  check("and none of them got onto the board", after.body.totals.total === started + 1,
    `${after.body.totals.total}`);

  /* --- scheduling ------------------------------------------------------ */
  r = await post({ title: "Speech Day", body: "Full uniform, please.", audience: "all", publishedOn: plus(6) });
  check("a notice can be dated ahead", r.status === 200 && r.body.message.includes("goes on the board"),
    r.body.message);
  const sched = r.body.announcements.find((a) => a.title === "Speech Day");
  check("and is marked scheduled", sched?.scheduled === true);
  check("scheduled ones are counted apart", r.body.totals.scheduled >= 1);

  const pupilNow = await call("/api/portal/dashboard", { cookie: pupil.cookie });
  check("nobody sees it before its date",
    !pupilNow.body.announcements.some((a) => a.title === "Speech Day"),
    pupilNow.body.announcements.map((a) => a.title).join(", "));

  // Dating it today should put it up immediately.
  r = await call("/api/portal/announcements", { method: "PATCH", cookie: admin.cookie,
    body: { id: Number(sched.id), title: "Speech Day", body: "Full uniform, please.",
            audience: "all", publishedOn: today } });
  check("moving the date forward publishes it", r.status === 200, `${r.status}`);
  const pupilAfter = await call("/api/portal/dashboard", { cookie: pupil.cookie });
  check("and now a pupil sees it",
    pupilAfter.body.announcements.some((a) => a.title === "Speech Day"));

  /* --- editing and deleting -------------------------------------------- */
  r = await call("/api/portal/announcements", { method: "PATCH", cookie: admin.cookie,
    body: { id: Number(mine.id), title: "Founders Day (moved)", body: "Now the last Friday of term.",
            audience: "all" } });
  check("a notice can be edited", r.status === 200 && r.body.ok === true, `${r.status}`);
  const edited = r.body.announcements.find((a) => a.id === mine.id);
  check("the change stuck", edited?.title === "Founders Day (moved)" && edited?.audience === "all");
  check("and it records that it was edited", Boolean(edited?.updated_at));
  check("editing does not move the date when none is given",
    String(edited?.published_on).slice(0, 10) === today, String(edited?.published_on));

  const nope = await call("/api/portal/announcements", { method: "PATCH", cookie: admin.cookie,
    body: { id: 99999999, title: "Nowhere", body: "Nothing to edit.", audience: "all" } });
  check("editing one that is not there is a plain 404", nope.status === 404, `${nope.status}`);

  r = await call(`/api/portal/announcements?id=${mine.id}`, { method: "DELETE", cookie: admin.cookie });
  check("a notice can be taken down", r.status === 200 && r.body.ok === true, `${r.status}`);
  check("it says which one", r.body.message.includes("Founders Day (moved)"), r.body.message);
  check("and it is gone", !r.body.announcements.some((a) => a.id === mine.id));

  const gone = await call(`/api/portal/announcements?id=${mine.id}`, { method: "DELETE", cookie: admin.cookie });
  check("deleting it twice is a plain 404, not a crash", gone.status === 404, `${gone.status}`);
  const silly = await call("/api/portal/announcements?id=nonsense", { method: "DELETE", cookie: admin.cookie });
  check("a nonsense id is refused", silly.status === 400, `${silly.status}`);

  /* --- who may write --------------------------------------------------- */
  for (const [who, name] of [[pupil, "a pupil"], [parent, "a parent"], [teacher, "a teacher who is not an admin"]]) {
    const tried = await call("/api/portal/announcements", { method: "POST", cookie: who.cookie,
      body: { title: "No school tomorrow", body: "Signed, not the head.", audience: "all" } });
    check(`${name} cannot post a notice`, tried.status === 403, `${tried.status}`);
    const del = await call(`/api/portal/announcements?id=${sched.id}`, { method: "DELETE", cookie: who.cookie });
    check(`${name} cannot take one down`, del.status === 403, `${del.status}`);
  }
  const anon = await call("/api/portal/announcements", { method: "POST",
    body: { title: "No school tomorrow", body: "Signed, nobody.", audience: "all" } });
  check("a stranger cannot post one", anon.status === 401, `${anon.status}`);

  const wrongMethod = await call("/api/portal/announcements", { method: "PUT", cookie: admin.cookie, body: {} });
  check("an unsupported method is refused", wrongMethod.status === 405, `${wrongMethod.status}`);
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
    ["a pupil cannot read the roll",            "/api/portal/pupils",  pupil,   "portal.html"],
    ["a pupil cannot read the staff list",      "/api/portal/staff",   pupil,   "portal.html"],
    ["a parent cannot read the roll",           "/api/portal/pupils",  parent,  "parent.html"],
    ["a teacher who is not an admin cannot either", "/api/portal/staff", teacher, "teacher.html"],
    ["a pupil cannot read the notice board",    "/api/portal/announcements", pupil, "portal.html"],
    ["an administrator is not a parent",        "/api/portal/parent",  admin,   "teacher.html"],
  ];
  for (const [name, path, who, home] of cases) {
    const r = await call(path, { cookie: who.cookie });
    check(name, r.status === 403, `${r.status} ${r.body.message || ""}`);
    check(`${name}: pointed at their own dashboard`, r.body.home === home, r.body.home);
  }

  for (const path of ["/api/portal/parent", "/api/portal/teacher", "/api/portal/admin",
                      "/api/portal/pupils", "/api/portal/staff"]) {
    const r = await call(path);
    check(`${path} needs a sign-in`, r.status === 401, String(r.status));
  }
}

/* -------------------------------------------------------------------- demo */
console.log("\ndemo preview, with no sign-in");
{
  for (const [section, key] of [["parent", "child"], ["teacher", "classes"], ["admin", "totals"],
                               ["pupils", "classes"], ["staff", "totals"],
                               ["announcements", "totals"]]) {
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

  // An integration can leave two set at once: Prisma Postgres puts its proxy
  // URL in DATABASE_URL. Taking that just because it is first would refuse a
  // working database sitting in the next variable along.
  clear();
  process.env.DATABASE_URL = "prisma+postgres://accelerate.prisma-data.net/?api_key=ey";
  process.env.POSTGRES_URL = "postgres://x@y/z";
  check("a usable string beats an unusable one, whatever the order",
    databaseUrlVar() === "POSTGRES_URL", String(databaseUrlVar()));

  clear();
  process.env.DATABASE_URL = "prisma+postgres://accelerate.prisma-data.net/?api_key=ey";
  check("with nothing usable, the one that was set is still named",
    databaseUrlVar() === "DATABASE_URL", String(databaseUrlVar()));

  // Vercel prefixes an integration's variables when the plain name is taken, so
  // a second database attached to the same project lands as NEON_DATABASE_URL.
  const prefixed = ["NEON_DATABASE_URL", "STORAGE_POSTGRES_URL", "POSTGRES_URL_NO_SSL"];
  const wipe = () => { clear(); prefixed.forEach((k) => delete process.env[k]); };

  wipe();
  process.env.DATABASE_URL = "prisma+postgres://accelerate.prisma-data.net/?api_key=ey";
  process.env.NEON_DATABASE_URL = "postgres://x@y/z";
  check("a prefixed name is found when the plain one is unusable",
    databaseUrlVar() === "NEON_DATABASE_URL", String(databaseUrlVar()));

  wipe();
  process.env.DATABASE_URL = "postgres://a@b/c";
  process.env.NEON_DATABASE_URL = "postgres://x@y/z";
  check("a documented name still wins over a discovered one",
    databaseUrlVar() === "DATABASE_URL", String(databaseUrlVar()));

  wipe();
  process.env.NEON_DATABASE_URL = "postgres://x@y/z";
  process.env.STORAGE_POSTGRES_URL = "postgres://q@r/s";
  check("two discovered names resolve the same way every time",
    databaseUrlVar() === "NEON_DATABASE_URL", String(databaseUrlVar()));

  // TLS off against a hosted database is not something to fall into by accident.
  wipe();
  process.env.POSTGRES_URL_NO_SSL = "postgres://x@y/z";
  check("POSTGRES_URL_NO_SSL is not picked up on its own",
    databaseUrlVar() === null, String(databaseUrlVar()));

  // Only names that say so count: nothing else in the environment is read.
  wipe();
  process.env.SOME_OTHER_THING = "postgres://x@y/z";
  check("an unrelated variable holding a URL is ignored",
    databaseUrlVar() === null, String(databaseUrlVar()));
  delete process.env.SOME_OTHER_THING;

  wipe();

  clear();
  Object.assign(process.env, saved);
}

/* ------------------------- the order someone actually does things in --------- */
console.log("\nsigning up before loading the sample data");
{
  // A fresh site: tables, no data. Exactly what pressing "Create the tables"
  // leaves behind.
  await query(`TRUNCATE sessions, auth_attempts, users, register, staff_register,
                        subject_results, attendance, assignment_submissions, messages,
                        timetable, assignments, announcements
               RESTART IDENTITY CASCADE`);

  const pupil = await signup({
    role: "student", fullName: "Praise Christopher", email: "praise@example.com",
    phone: "08012341234", reference: "BFS/2026/0001", classLevel: "SS3",
  });
  check("a pupil can sign up on an empty database", pupil.status === 201,
    `${pupil.status} ${pupil.body.message || ""}`);

  let dash = await call("/api/portal/dashboard", { cookie: pupil.cookie });
  check("their dashboard loads, with nothing on it yet",
    dash.status === 200 && dash.body.today.length === 0, `${dash.status}`);

  // Guarding the sample data on "the register is empty" meant this refused:
  // their own sign-up had put a row in it, so the one button that would fill
  // the dashboard was locked behind the act of creating an account.
  const seeded = await call("/api/auth/seed", { method: "POST" });
  check("the sample data still loads after a sign-up",
    seeded.status === 200, `${seeded.status} ${seeded.body.message || ""}`);

  dash = await call("/api/portal/dashboard", { cookie: pupil.cookie });
  check("their class has a timetable, though the fixture never heard of them",
    dash.body.today.length === 5, `${dash.body.today?.length}`);
  check("homework is set for their class", dash.body.assignments.length === 4,
    `${dash.body.assignments?.length}`);
  check("one piece of work is marked handed in",
    dash.body.assignments.filter((a) => a.submitted).length === 1);
  check("results are published for them", dash.body.results.length === 5,
    `${dash.body.results?.length}`);
  check("an average is worked out", Number.isInteger(dash.body.average) && dash.body.average > 0,
    `${dash.body.average}`);
  check("attendance is recorded for them", dash.body.attendance.total === 49,
    `${dash.body.attendance?.total}`);
  check("and they have messages waiting", dash.body.unreadMessages === 3,
    `${dash.body.unreadMessages}`);

  // What the guard is actually for: a school's own register, once imported.
  await query("UPDATE register SET source = 'import'");
  const again = await call("/api/auth/seed", { method: "POST" });
  check("an imported register does still lock the sample data",
    again.status === 409, `${again.status} ${again.body.message || ""}`);
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
