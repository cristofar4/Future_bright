/* One pooled pg client, reused across warm serverless invocations. */
import pg from "pg";

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
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
