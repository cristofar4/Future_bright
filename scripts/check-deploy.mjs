/* Deployment constraints that are easy to break and only show up as a failed
 * build. Runs in a second and needs no database.
 *
 *   node scripts/check-deploy.mjs
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Vercel Hobby allows 12 Serverless Functions per deployment. Going over fails
// the build with "No more than 12 Serverless Functions can be added".
const FUNCTION_LIMIT = 12;

let problems = 0;
const fail = (msg) => { console.log(`  FAIL  ${msg}`); problems++; };
const pass = (msg) => console.log(`  PASS  ${msg}`);

/** Every file under api/ that Vercel turns into a function. Anything whose
 *  name or parent directory starts with "_" is excluded. */
async function functionFiles(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { await functionFiles(full, out); }
    else if (/\.(js|mjs|ts)$/.test(entry.name)) { out.push(relative(ROOT, full)); }
  }
  return out;
}

console.log("deployment checks");

const fns = (await functionFiles(join(ROOT, "api"))).sort();
if (fns.length > FUNCTION_LIMIT) {
  fail(`${fns.length} Serverless Functions, over the Hobby limit of ${FUNCTION_LIMIT}:`);
  fns.forEach((f) => console.log(`          ${f}`));
  console.log("        Collapse related endpoints behind a dynamic route, as");
  console.log("        api/auth/[action].js and api/portal/[section].js do.");
} else {
  pass(`${fns.length} Serverless Functions, within the Hobby limit of ${FUNCTION_LIMIT}`);
  fns.forEach((f) => console.log(`          ${f}`));
}

// vercel.json must be valid JSON or the deployment is rejected outright.
try {
  const raw = await readFile(join(ROOT, "vercel.json"), "utf8");
  JSON.parse(raw);
  pass("vercel.json is valid JSON");
} catch (err) {
  fail(`vercel.json: ${err.message}`);
}

// Every handler a dispatcher imports must exist.
for (const [dispatcher, folder] of [
  ["api/auth/[action].js", "api/auth/_routes"],
  ["api/portal/[section].js", "api/portal/_routes"],
]) {
  try {
    const src = await readFile(join(ROOT, dispatcher), "utf8");
    const imported = [...src.matchAll(/from "\.\/_routes\/([\w-]+)\.js"/g)].map((m) => m[1]);
    const onDisk = (await readdir(join(ROOT, folder))).filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, ""));

    const missing = imported.filter((n) => !onDisk.includes(n));
    const unrouted = onDisk.filter((n) => !imported.includes(n));

    if (missing.length) { fail(`${dispatcher} imports handlers that do not exist: ${missing.join(", ")}`); }
    else if (unrouted.length) { fail(`${folder} has handlers no dispatcher routes: ${unrouted.join(", ")}`); }
    else { pass(`${dispatcher} routes all ${imported.length} handlers in ${folder}`); }
  } catch (err) {
    fail(`${dispatcher}: ${err.message}`);
  }
}

// api/_lib/schema.js is generated from db/*.sql. If they drift, the migrate
// endpoint creates tables that do not match what the code expects.
try {
  const { render } = await import("./build-schema.mjs");
  const expected = await render();
  const actual = await readFile(join(ROOT, "api", "_lib", "schema.js"), "utf8");
  expected === actual
    ? pass("api/_lib/schema.js matches db/*.sql")
    : fail("api/_lib/schema.js is out of date. Run: node scripts/build-schema.mjs");
} catch (err) {
  fail(`schema check: ${err.message}`);
}

// package.json must declare its runtime dependencies, or the functions crash
// on Vercel with MODULE_NOT_FOUND.
try {
  const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const deps = Object.keys(pkg.dependencies || {});
  deps.includes("pg")
    ? pass("pg is a declared dependency")
    : fail("pg is imported by api/_lib/db.js but not in dependencies");
  pkg.type === "module"
    ? pass('package.json sets "type": "module", matching the ESM handlers')
    : fail('handlers use ESM import syntax but package.json does not set "type": "module"');
} catch (err) {
  fail(`package.json: ${err.message}`);
}

console.log(problems ? `\n${problems} problem(s)` : "\nAll deployment checks passed");
process.exit(problems ? 1 : 0);
