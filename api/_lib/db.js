/* One pooled pg client, reused across warm serverless invocations. */
import pg from "pg";

let pool;

/* DATABASE_URL is what we document, but Vercel's own Postgres and the Supabase
 * and Neon integrations each set their own name when you click "connect to
 * project". Accept those too, rather than making someone rename a variable
 * they did not create. See databaseUrlVar below for which one is picked. */
const URL_VARS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

/* This talks to Postgres over the wire with `pg`. Some managed offerings hand
 * out a proxy URL instead of a Postgres one - Prisma Postgres gives you
 * `prisma+postgres://...?api_key=...`, which only the Prisma client can open.
 * Spot that here so the answer is "this needs a direct connection string"
 * rather than a connection timeout nobody can interpret. */
export function isDirectPostgresUrl(url) {
  const s = String(url || "").trim();
  return s.startsWith("/")                       // local unix socket
      || /^postgres(ql)?:\/\//i.test(s);
}

const valueOf = (name) => String(process.env[name] || "").trim();

/**
 * The name of the variable the connection string came from, or null.
 *
 * A usable URL wins over the list order, because an integration can leave two
 * variables set at once: Prisma Postgres puts its proxy URL in DATABASE_URL and
 * a direct one may sit alongside it. Taking DATABASE_URL just because it is
 * first would refuse a database that is right there and working. Only when
 * nothing usable is set does this fall back to whatever was set first, so the
 * setup page can name the variable it had to reject.
 */
export function databaseUrlVar() {
  const set = URL_VARS.filter(valueOf);
  return set.find((name) => isDirectPostgresUrl(valueOf(name))) || set[0] || null;
}

export function databaseUrl() {
  const name = databaseUrlVar();
  return name ? valueOf(name) : null;
}

export function getPool() {
  if (!pool) {
    const connectionString = databaseUrl();
    if (!connectionString) {
      throw Object.assign(new Error("DATABASE_URL is not set"), { code: "NO_DATABASE" });
    }
    if (!isDirectPostgresUrl(connectionString)) {
      throw Object.assign(
        new Error("The connection string is not a direct Postgres URL"),
        { code: "BAD_DATABASE_URL" }
      );
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
