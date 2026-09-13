/* Tests for open sign-up.
 *   DATABASE_URL=postgres://... node scripts/test-signup-mode.mjs
 */
import { createServer } from "node:http";
import { query, closePool } from "../api/_lib/db.js";

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

async function call(path, { method = "POST", body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, body: json || {}, cookie: (res.headers.get("set-cookie") || "").split(";")[0] };
}

const PW = "korrect-horse-9021";
const me = (over = {}) => ({
  role: "student", fullName: "Christopher Praise", email: "christopher@example.com",
  phone: "+2349036961268", reference: "20211302562", classLevel: "SS2",
  password: PW, confirmPassword: PW, ...over,
});

async function wipe() {
  await query("TRUNCATE sessions, auth_attempts, users RESTART IDENTITY CASCADE");
  await query("TRUNCATE register, staff_register RESTART IDENTITY CASCADE");
}

// ================= empty register: open by default ========================
console.log("\nempty register (a fresh deployment)");
delete process.env.PORTAL_OPEN_SIGNUP;
await wipe();
{
  let r = await call("/api/auth/mode", { method: "GET" });
  check("mode reports open", r.body.configured === true && r.body.openSignup === true, JSON.stringify(r.body));

  r = await call("/api/auth/signup", { body: me() });
  check("anyone can sign up with their own number", r.status === 201, `${r.status} ${r.body.message || ""}`);
  check("session cookie issued", /bfss_session=/.test(r.cookie));
  check("linked to a new register entry", r.body.user.admissionNo === "20211302562", r.body.user?.admissionNo);
  check("class recorded", r.body.user.classLevel === "SS2", r.body.user?.classLevel);

  const reg = await query("SELECT surname, other_names, class_level, class_arm FROM register");
  check("register entry created from the name given",
    reg.rows[0].surname === "Praise" && reg.rows[0].other_names === "Christopher",
    JSON.stringify(reg.rows[0]));
  check("class arm defaults to A so the portal shows SS2A", reg.rows[0].class_arm === "A");

  const d = await call("/api/portal/dashboard", { method: "GET", cookie: r.cookie });
  check("the dashboard loads for the new account", d.status === 200, String(d.status));
  check("dashboard shows their class", d.body.student.className === "SS2A", d.body.student?.className);

  r = await call("/api/auth/signup", { body: me({ email: "someone.else@example.com" }) });
  check("the same number cannot be claimed twice", r.status === 409, String(r.status));

  r = await call("/api/auth/signup", { body: me({ password: "short", confirmPassword: "short" }) });
  check("weak passwords still refused in open mode", r.status === 400 && r.body.error === "weak_password");

  r = await call("/api/auth/signup", { body: me({ email: "bad-email", reference: "X1" }) });
  check("invalid email still refused in open mode", r.status === 400 && r.body.error === "invalid_email");

  r = await call("/api/auth/mode", { method: "GET" });
  check("creating an account does not close sign-up behind you", r.body.openSignup === true,
    JSON.stringify(r.body));

  r = await call("/api/auth/signup", {
    body: { role: "teacher", fullName: "Praise Christopher", email: "teach@example.com",
            phone: "", reference: "STF/001", classLevel: "", password: PW, confirmPassword: PW },
  });
  check("teachers can sign up in open mode too", r.status === 201, `${r.status} ${r.body.message || ""}`);
  const staff = await query("SELECT staff_no, surname FROM staff_register");
  check("staff entry created", staff.rows.length === 1 && staff.rows[0].surname === "Christopher",
    JSON.stringify(staff.rows[0]));
}

// ================= register present: closes itself ========================
console.log("\nregister imported (a live school)");
{
  await query(`INSERT INTO register (admission_no, surname, other_names, class_level, class_arm, status, source)
               VALUES ('BFS/2025/0001', 'Real', 'Pupil', 'SS1', 'A', 'active', 'import')`);

  let r = await call("/api/auth/mode", { method: "GET" });
  check("mode flips to closed once a register exists", r.body.openSignup === false, JSON.stringify(r.body));

  r = await call("/api/auth/signup", { body: me({ reference: "MADE-UP-999", email: "nope@example.com" }) });
  check("an invented number is now refused", r.status === 400 && r.body.error === "no_match", String(r.status));

  const count = await query("SELECT count(*)::int n FROM register");
  check("no register entry created by the refusal", count.rows[0].n === 2, String(count.rows[0].n));

  r = await call("/api/auth/signup", {
    body: me({ reference: "BFS/2025/0001", fullName: "Pupil Real", classLevel: "SS1", email: "real@example.com" }),
  });
  check("a real pupil can still sign up", r.status === 201, `${r.status} ${r.body.message || ""}`);
}

// ================= demo data must not close sign-up =======================
console.log("\ndemo data versus a real import");
{
  await wipe();
  await query(`INSERT INTO register (admission_no, surname, other_names, class_level, class_arm, status, source)
               VALUES ('DEMO/1', 'Demo', 'Pupil', 'SS1', 'A', 'active', 'demo')`);
  let r = await call("/api/auth/mode", { method: "GET" });
  check("demo rows leave sign-up open", r.body.openSignup === true, JSON.stringify(r.body));

  // Importing over a demo row must re-mark it, or a live school stays open.
  await query(
    `INSERT INTO register (admission_no, surname, other_names, class_level, guardian_email, guardian_phone, status, source)
     VALUES ('DEMO/1', 'Demo', 'Pupil', 'SS1', NULL, NULL, 'active', 'import')
     ON CONFLICT (upper(replace(admission_no, ' ', ''))) DO UPDATE
       SET source = 'import', updated_at = now()`
  );
  r = await call("/api/auth/mode", { method: "GET" });
  check("importing over a demo row closes sign-up", r.body.openSignup === false, JSON.stringify(r.body));
}

// ================= explicit overrides =====================================
console.log("\nexplicit overrides");
{
  process.env.PORTAL_OPEN_SIGNUP = "true";
  let r = await call("/api/auth/mode", { method: "GET" });
  check("PORTAL_OPEN_SIGNUP=true forces open", r.body.openSignup === true);
  r = await call("/api/auth/signup", { body: me({ reference: "FORCED-1", email: "forced@example.com" }) });
  check("open override lets an invented number through", r.status === 201, `${r.status} ${r.body.message || ""}`);

  process.env.PORTAL_OPEN_SIGNUP = "false";
  await wipe();
  r = await call("/api/auth/mode", { method: "GET" });
  check("PORTAL_OPEN_SIGNUP=false forces closed even with an empty register", r.body.openSignup === false);
  r = await call("/api/auth/signup", { body: me() });
  check("closed override refuses everything", r.status === 400 && r.body.error === "no_match", String(r.status));
  delete process.env.PORTAL_OPEN_SIGNUP;
}

server.close();
await closePool();
console.log(`\n${pass} passed, ${fail} failed`);
failures.forEach((f) => console.log("  -", f));
process.exit(fail ? 1 : 0);
