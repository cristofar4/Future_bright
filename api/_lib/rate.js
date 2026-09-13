/* Database-backed rate limiting. Serverless instances do not share memory, so
   the counter has to live somewhere both of them can see. */
import { query } from "./db.js";

const WINDOW_MINUTES = 15;

const LIMITS = {
  login:  { perIp: 20, perIdentifier: 6 },
  signup: { perIp: 10, perIdentifier: 5 },
};

/**
 * Returns null when the request may proceed, or a message when it may not.
 * Only failed attempts count, so someone signing in correctly all day is fine.
 */
export async function checkRateLimit(kind, ip, identifier) {
  const limits = LIMITS[kind];
  if (!limits) return null;

  const buckets = [`${kind}:ip:${ip}`];
  if (identifier) buckets.push(`${kind}:id:${identifier}`);

  const { rows } = await query(
    `SELECT bucket, count(*)::int AS n
       FROM auth_attempts
      WHERE bucket = ANY($1)
        AND succeeded = false
        AND at > now() - ($2 || ' minutes')::interval
      GROUP BY bucket`,
    [buckets, String(WINDOW_MINUTES)]
  );

  for (const row of rows) {
    const cap = row.bucket.includes(":ip:") ? limits.perIp : limits.perIdentifier;
    if (row.n >= cap) {
      return `Too many attempts. Please wait ${WINDOW_MINUTES} minutes and try again.`;
    }
  }
  return null;
}

export async function recordAttempt(kind, ip, identifier, succeeded) {
  const buckets = [`${kind}:ip:${ip}`];
  if (identifier) buckets.push(`${kind}:id:${identifier}`);
  await query(
    `INSERT INTO auth_attempts (bucket, succeeded)
     SELECT unnest($1::text[]), $2`,
    [buckets, Boolean(succeeded)]
  );
}

/** Opportunistic cleanup so the table does not grow without bound. */
export async function pruneAttempts() {
  await query(`DELETE FROM auth_attempts WHERE at < now() - interval '1 day'`);
}
