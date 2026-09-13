/* Apply the SQL files through the pg driver, so no psql client is needed.
 *
 *   node scripts/db.mjs setup   # tables and indexes
 *   node scripts/db.mjs demo    # sample register, timetable, results
 *   node scripts/db.mjs status  # what is connected and what is in it
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { query, closePool } from "../api/_lib/db.js";

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = (name) => join(here, "..", "db", name);

const SETS = {
  setup: ["schema.sql", "portal-schema.sql"],
  demo:  ["demo-register.sql", "demo-portal.sql"],
};

async function apply(files) {
  for (const file of files) {
    process.stdout.write(`  ${file} ... `);
    await query(await readFile(sqlPath(file), "utf8"));
    console.log("done");
  }
}

async function status() {
  const tables = await query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`
  );
  if (!tables.rows.length) {
    console.log("Connected, but no tables yet. Run: npm run db:setup");
    return;
  }
  console.log("Tables:", tables.rows.map((r) => r.table_name).join(", "));

  const counts = await query(
    `SELECT (SELECT count(*) FROM register WHERE status = 'active')::int AS pupils,
            (SELECT count(*) FROM register WHERE status = 'active' AND source = 'import')::int AS imported,
            (SELECT count(*) FROM staff_register WHERE status = 'active')::int AS staff,
            (SELECT count(*) FROM users)::int AS accounts,
            (SELECT count(*) FROM timetable)::int AS lessons`
  );
  const c = counts.rows[0];
  console.log(`Register: ${c.pupils} pupils (${c.imported} imported), ${c.staff} staff`);
  console.log(`Accounts: ${c.accounts}`);
  console.log(`Timetable rows: ${c.lessons}`);

  const flag = String(process.env.PORTAL_OPEN_SIGNUP || "").toLowerCase();
  const forced = flag === "true" || flag === "1" ? true
               : flag === "false" || flag === "0" ? false : null;
  const open = forced === null ? c.imported === 0 : forced;

  console.log("\nSign-up is " + (open ? "OPEN" : "CLOSED") +
    (forced === null ? " (no PORTAL_OPEN_SIGNUP set)" : ` (PORTAL_OPEN_SIGNUP=${flag})`));
  console.log(open
    ? "Any admission or staff number is accepted and an entry is created for it.\n" +
      "Importing a real register closes this automatically. Demo rows do not."
    : "Details must match a row in the register.\n" +
      "Set PORTAL_OPEN_SIGNUP=true to accept anyone anyway (evaluation only).");
}

async function main() {
  const command = process.argv[2];
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.\n");
    console.error("Locally:  export DATABASE_URL=\"postgres://user:pass@host/db\"");
    console.error("On Vercel: Project -> Settings -> Environment Variables");
    process.exit(2);
  }

  if (command === "status") { await status(); }
  else if (SETS[command]) {
    console.log(`Applying ${command}:`);
    await apply(SETS[command]);
    console.log("\nAll done.");
    if (command === "setup") { console.log("Next: npm run db:demo (optional sample data), then sign up."); }
  } else {
    console.error("Usage: node scripts/db.mjs <setup|demo|status>");
    process.exit(2);
  }
  await closePool();
}

main().catch(async (err) => {
  console.error("\nFailed:", err.message);
  if (/self.signed|certificate/i.test(err.message)) {
    console.error("If your provider needs SSL, keep ?sslmode=require on the connection string.");
  }
  await closePool().catch(() => {});
  process.exit(1);
});
