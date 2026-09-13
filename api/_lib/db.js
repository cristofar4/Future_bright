/* One pooled pg client, reused across warm serverless invocations. */
import pg from "pg";

let pool;

/* DATABASE_URL is what we document, but Vercel's own Postgres and the Supabase
 * and Neon integrations each set their own name when you click "connect to
 * project". Accept those too, rather than making someone rename a variable
 * they did not create. First one set wins. */
const URL_VARS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

/** The name of the variable the connection string came from, or null. */
export function databaseUrlVar() {
  return URL_VARS.find((name) => String(process.env[name] || "").trim()) || null;
}

export function databaseUrl() {
  const name = databaseUrlVar();
  return name ? String(process.env[name]).trim() : null;
}

export function getPool() {
  if (!pool) {
    const connectionString = databaseUrl();
    if (!connectionString) {
      throw Object.assign(new Error("DATABASE_URL is not set"), { code: "NO_DATABASE" });
    }
    pool = new pg.Pool({
      connectionString,
      // Managed Postgres (Neon, Supabase, Vercel) terminates TLS with its own
      // chain; local development over a unix socket or localhost does not.
      ssl: /\blocalhost\b|^\/|127\.0\.0\.1|sslmode=disable/.test(connectionString)
        ? false
        : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
    pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  }
  return pool;
}

/** Parameterised query. Never build SQL by concatenating user input. */
export function query(text, params = []) {
  return getPool().query(text, params);
}

export async function closePool() {
  if (pool) {
    const p = pool;
    pool = undefined;
    await p.end();
  }
}
