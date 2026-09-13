/* End-to-end tests for the portal auth endpoints.
 * Runs the real handlers against a real Postgres.
 *
 *   DATABASE_URL=postgres://... node scripts/test-auth.mjs
 *
 * The database is reset between runs, so point it at a scratch database.
 */
import { createServer } from "node:http";
import { query, closePool } from "../api/_lib/db.js";
import { hashPassword, verifyPassword, newSessionToken, hashToken } from "../api/_lib/crypto.js";

const handlers = {
  "/api/auth/signup": (await import("../api/auth/signup.js")).default,
  "/api/auth/login":  (await import("../api/auth/login.js")).default,
  "/api/auth/logout": (await import("../api/auth/logout.js")).default,
  "/api/auth/me":     (await import("../api/auth/me.js")).default,
};

let pass = 0, fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ""}`); }
}

// ---- a tiny server so cookies and headers behave like the real thing -------
const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const handler = handlers[pathname];
  if (!handler) { res.statusCode = 404; return res.end("{}"); }
  try { await handler(req, res); }
  catch (err) { console.error(err); res.statusCode = 500; res.end("{}"); }
});

await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

async function call(path, { method = "POST", body, cookie, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json, setCookie: res.headers.get("set-cookie") };
}

function cookieFrom(setCookie) {
  return setCookie ? setCookie.split(";")[0] : "";
}

async function reset() {
  await query("TRUNCATE sessions, auth_attempts, users RESTART IDENTITY CASCADE");
  await query("TRUNCATE register, staff_register RESTART IDENTITY CASCADE");
  await query(`INSERT INTO register (admission_no, surname, other_names, class_level, guardian_email, guardian_phone, status) VALUES
    ('BFS/2025/0142','Okafor','Chidera','SS2','amaka.okafor@example.com','+234 802 111 2233','active'),
    ('BFS/2025/0187','Bello','Ibrahim','JSS2','amina.bello@example.com','08033445566','active'),
    ('BFS/2019/0007','Eze','Ngozi','SS3','ngozi.eze@example.com',NULL,'left')`);
  await query(`INSERT INTO staff_register (staff_no, surname, other_names, email, status) VALUES
    ('BFS/STF/014','Ogun','Folake','folake.ogun@brightfuture.edu.ng','active'),
    ('BFS/STF/022','Ibrahim','Samuel',NULL,'active')`);
}

const GOOD_PW = "korrect-horse-9021";
const student = (over = {}) => ({
  role: "student", fullName: "Chidera Okafor", email: "chidera@example.com",
  phone: "08011112222", reference: "BFS/2025/0142", classLevel: "SS2",
  password: GOOD_PW, confirmPassword: GOOD_PW, ...over,
});

// =========================== password hashing ==============================
console.log("\npassword hashing");
{
  const h = await hashPassword("a-test-password-1");
  check("hash is scrypt with salt and params", /^scrypt\$\d+\$\d+\$\d+\$[\w+/=]+\$[\w+/=]+$/.test(h), h.slice(0, 24));
  check("correct password verifies", await verifyPassword("a-test-password-1", h));
  check("wrong password rejected", !(await verifyPassword("a-test-password-2", h)));
  const h2 = await hashPassword("a-test-password-1");
  check("same password hashes differently (salted)", h !== h2);
  check("malformed hash rejected, does not throw", !(await verifyPassword("x", "not-a-hash")));
  check("empty stored hash rejected", !(await verifyPassword("x", "")));
}

// =========================== signup: validation ============================
console.log("\nsignup validation");
await reset();
{
  let r = await call("/api/auth/signup", { body: student({ password: "short1", confirmPassword: "short1" }) });
  check("short password rejected", r.status === 400 && r.body.error === "weak_password", `${r.status} ${r.body?.error}`);

  r = await call("/api/auth/signup", { body: student({ confirmPassword: "different-9021-x" }) });
  check("mismatched confirmation rejected", r.status === 400 && r.body.error === "password_mismatch");

  r = await call("/api/auth/signup", { body: student({ email: "not-an-email" }) });
  check("invalid email rejected", r.status === 400 && r.body.error === "invalid_email");

  r = await call("/api/auth/signup", { body: student({ fullName: "Chidera" }) });
  check("single-word name rejected", r.status === 400 && r.body.error === "invalid_name");

  r = await call("/api/auth/signup", { body: student({ role: "admin" }) });
  check("unknown role rejected", r.status === 400 && r.body.error === "invalid_role");

  r = await call("/api/auth/signup", { body: student({ classLevel: "SS9" }) });
  check("invalid class rejected", r.status === 400 && r.body.error === "invalid_class");

  r = await call("/api/auth/signup", { body: student({ password: "mypassword123", confirmPassword: "mypassword123" }) });
  check("common password rejected", r.status === 400 && r.body.error === "weak_password");

  r = await call("/api/auth/signup", { body: student({ password: "Chidera-okafor-77", confirmPassword: "Chidera-okafor-77" }) });
  check("password containing own name rejected", r.status === 400 && r.body.error === "weak_password");

  r = await call("/api/auth/signup", { method: "GET" });
  check("GET on signup rejected", r.status === 405);
}

// =========================== signup: register check ========================
console.log("\nsignup checks the register");
await reset();
{
  let r = await call("/api/auth/signup", { body: student({ reference: "BFS/9999/0001" }) });
  check("unknown admission number rejected", r.status === 400 && r.body.error === "no_match");

  r = await call("/api/auth/signup", { body: student({ classLevel: "JSS1" }) });
  check("wrong class for that pupil rejected", r.status === 400 && r.body.error === "no_match");

  r = await call("/api/auth/signup", { body: student({ fullName: "Chidera Nwosu" }) });
  check("surname not matching register rejected", r.status === 400 && r.body.error === "no_match");

  r = await call("/api/auth/signup", {
    body: student({ reference: "BFS/2019/0007", fullName: "Ngozi Eze", classLevel: "SS3" }),
  });
  check("pupil who has left cannot sign up", r.status === 400 && r.body.error === "no_match");

  check("no accounts created by failed attempts",
    (await query("SELECT count(*)::int n FROM users")).rows[0].n === 0);

  r = await call("/api/auth/signup", { body: student() });
  check("valid student signup succeeds", r.status === 201, `${r.status} ${r.body?.message || ""}`);
  check("session cookie is set", /bfss_session=/.test(r.setCookie || ""));
  check("cookie is HttpOnly", /HttpOnly/i.test(r.setCookie || ""));
  check("cookie is SameSite=Lax", /SameSite=Lax/i.test(r.setCookie || ""));
  check("response carries no password hash", !JSON.stringify(r.body).toLowerCase().includes("scrypt"));
  check("user linked to register row", r.body?.user?.admissionNo === "BFS/2025/0142");

  r = await call("/api/auth/signup", { body: student({ email: "someone.else@example.com" }) });
  check("same pupil cannot sign up twice", r.status === 409, `${r.status}`);

  r = await call("/api/auth/signup", {
    body: student({ reference: "BFS/2025/0187", fullName: "Ibrahim Bello", classLevel: "JSS2" }),
  });
  check("duplicate email rejected", r.status === 409);

  r = await call("/api/auth/signup", {
    body: student({ reference: " bfs/2025/0187 ", fullName: "Ibrahim Bello",
                    classLevel: "JSS2", email: "ibrahim@example.com" }),
  });
  check("admission number matched despite case and spaces", r.status === 201, `${r.status} ${r.body?.message || ""}`);
}

// =========================== parent and teacher ============================
console.log("\nparent and teacher signup");
await reset();
{
  const parent = (over = {}) => ({
    role: "parent", fullName: "Amaka Okafor", email: "amaka.okafor@example.com",
    phone: "08099998888", reference: "BFS/2025/0142", classLevel: "SS2",
    password: GOOD_PW, confirmPassword: GOOD_PW, ...over,
  });

  let r = await call("/api/auth/signup", { body: parent({ email: "stranger@example.com", phone: "07000000000" }) });
  check("parent with unknown contact details rejected", r.status === 400 && r.body.error === "no_match");

  r = await call("/api/auth/signup", { body: parent() });
  check("parent matching guardian email accepted", r.status === 201, `${r.status} ${r.body?.message || ""}`);

  r = await call("/api/auth/signup", {
    body: parent({ reference: "BFS/2025/0187", classLevel: "JSS2", fullName: "Amina Bello",
                   email: "different@example.com", phone: "+234 803 344 5566" }),
  });
  check("parent matching guardian phone accepted", r.status === 201, `${r.status} ${r.body?.message || ""}`);

  const teacher = (over = {}) => ({
    role: "teacher", fullName: "Folake Ogun", email: "folake.ogun@brightfuture.edu.ng",
    phone: "", reference: "BFS/STF/014", classLevel: "",
    password: GOOD_PW, confirmPassword: GOOD_PW, ...over,
  });

  r = await call("/api/auth/signup", { body: teacher({ reference: "BFS/STF/999" }) });
  check("unknown staff number rejected", r.status === 400 && r.body.error === "no_match");

  r = await call("/api/auth/signup", { body: teacher({ email: "impostor@example.com" }) });
  check("staff email must match the one on file", r.status === 400 && r.body.error === "no_match");

  r = await call("/api/auth/signup", { body: teacher() });
  check("teacher signup succeeds without a class", r.status === 201, `${r.status} ${r.body?.message || ""}`);
  check("teacher linked to staff number", r.body?.user?.staffNo === "BFS/STF/014");

  r = await call("/api/auth/signup", {
    body: teacher({ reference: "BFS/STF/022", fullName: "Samuel Ibrahim", email: "samuel@example.com" }),
  });
  check("staff with no email on file may use any address", r.status === 201, `${r.status} ${r.body?.message || ""}`);
}

// =========================== login, me, logout =============================
console.log("\nlogin, session and logout");
await reset();
{
  const signed = await call("/api/auth/signup", { body: student() });
  check("setup signup succeeded", signed.status === 201);

  let r = await call("/api/auth/login", { body: { email: "chidera@example.com", password: "wrong-password-here" } });
  check("wrong password rejected", r.status === 401 && r.body.error === "bad_credentials");

  const unknown = await call("/api/auth/login", { body: { email: "nobody@example.com", password: GOOD_PW } });
  check("unknown email rejected", unknown.status === 401);
  check("unknown email and wrong password give the same message",
    unknown.body.message === r.body.message, `${unknown.body.message} / ${r.body.message}`);

  r = await call("/api/auth/login", { body: { email: "CHIDERA@Example.com ", password: GOOD_PW } });
  check("login succeeds and is case-insensitive on email", r.status === 200, `${r.status}`);
  const cookie = cookieFrom(r.setCookie);
  check("login sets a session cookie", Boolean(cookie));

  r = await call("/api/auth/me", { method: "GET", cookie });
  check("me returns the signed-in user", r.status === 200 && r.body.user.email === "chidera@example.com");
  check("me does not leak the hash", !JSON.stringify(r.body).includes("scrypt"));

  r = await call("/api/auth/me", { method: "GET" });
  check("me without a cookie is 401", r.status === 401);

  r = await call("/api/auth/me", { method: "GET", cookie: "bfss_session=forged-token-value" });
  check("forged session token rejected", r.status === 401);

  const raw = decodeURIComponent(cookie.split("=")[1]);
  const plaintext = await query("SELECT count(*)::int n FROM sessions WHERE token_hash = $1", [raw]);
  const hashed = await query("SELECT count(*)::int n FROM sessions WHERE token_hash = $1", [hashToken(raw)]);
  check("session token stored hashed, not in plaintext", plaintext.rows[0].n === 0 && hashed.rows[0].n === 1);

  r = await call("/api/auth/logout", { cookie });
  check("logout succeeds", r.status === 200);
  check("logout clears the cookie", /bfss_session=;/.test(r.setCookie || "") && /Max-Age=0/.test(r.setCookie || ""));
  const gone = await query("SELECT count(*)::int n FROM sessions WHERE token_hash = $1", [hashToken(raw)]);
  check("that session row is deleted", gone.rows[0].n === 0);
  check("the other device stays signed in",
    (await query("SELECT count(*)::int n FROM sessions")).rows[0].n === 1);

  r = await call("/api/auth/me", { method: "GET", cookie });
  check("old cookie no longer works after logout", r.status === 401);

  await query("UPDATE sessions SET expires_at = now() - interval '1 day'");
  const fresh = await call("/api/auth/login", { body: { email: "chidera@example.com", password: GOOD_PW } });
  await query("UPDATE sessions SET expires_at = now() - interval '1 day'");
  r = await call("/api/auth/me", { method: "GET", cookie: cookieFrom(fresh.setCookie) });
  check("expired session rejected", r.status === 401);
}

// =========================== rate limiting =================================
console.log("\nrate limiting");
await reset();
{
  await call("/api/auth/signup", { body: student() });
  let limited = false, statuses = [];
  for (let i = 0; i < 9; i++) {
    const r = await call("/api/auth/login", { body: { email: "chidera@example.com", password: `bad-guess-${i}` } });
    statuses.push(r.status);
    if (r.status === 429) { limited = true; break; }
  }
  check("repeated bad logins get rate limited", limited, statuses.join(","));

  const r = await call("/api/auth/login", { body: { email: "chidera@example.com", password: GOOD_PW } });
  check("correct password also blocked while limited", r.status === 429, `${r.status}`);

  await query("TRUNCATE auth_attempts");
  const after = await call("/api/auth/login", { body: { email: "chidera@example.com", password: GOOD_PW } });
  check("login works again once the window clears", after.status === 200, `${after.status}`);
}

// =========================== injection and abuse ===========================
console.log("\ninjection and malformed input");
await reset();
{
  let r = await call("/api/auth/login", {
    body: { email: "a'or'1'='1@x.com", password: "' OR '1'='1" },
  });
  check("SQL injection in login is just a failed login", r.status === 401);
  check("users table intact after injection attempt",
    (await query("SELECT count(*)::int n FROM users")).rows[0].n === 0);

  r = await call("/api/auth/signup", {
    body: student({ reference: "'; DROP TABLE users; --" }),
  });
  check("SQL injection in admission number is just no match", r.status === 400 && r.body.error === "no_match");
  check("users table still exists",
    (await query("SELECT count(*)::int n FROM users")).rows[0].n === 0);

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json",
  });
  check("malformed JSON returns 400, not a crash", res.status === 400);

  let bigStatus = 0;
  try {
    const big = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST", headers: { "Content-Type": "application/json", Connection: "close" },
      body: JSON.stringify({ role: "student", fullName: "x".repeat(200000) }),
    });
    bigStatus = big.status;
    await big.arrayBuffer();
  } catch (err) {
    bigStatus = `threw: ${err.cause?.code || err.message}`;
  }
  check("oversized body rejected with 413", bigStatus === 413, String(bigStatus));

  r = await call("/api/auth/signup", { body: { role: "student" } });
  check("missing fields rejected cleanly", r.status === 400);

  r = await call("/api/auth/signup", { body: student({ fullName: "<script>alert(1)</script> Okafor" }) });
  check("name with markup rejected by the character rule", r.status === 400 && r.body.error === "invalid_name");
}

// ================================ done =====================================
server.close();
await closePool();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("failing:"); failures.forEach((f) => console.log("  -", f)); }
process.exit(fail ? 1 : 0);
