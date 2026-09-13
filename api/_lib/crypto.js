/* Password hashing, session tokens and constant-time comparison.
   Uses only node:crypto, so there is no native build step on Vercel. */
import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

// OWASP's scrypt floor is N=2^15, r=8, p=1. Raise N, never lower it.
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

// scrypt needs memory of about 128 * N * r bytes, so the default 32MB cap is
// not enough at N=32768 (~32MB plus overhead).
const MAXMEM = 96 * 1024 * 1024;

/** Hash a password. Returns `scrypt$N$r$p$salt$hash`, all base64. */
export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Verify a password against a stored hash. Never throws on malformed input. */
export async function verifyPassword(password, stored) {
  try {
    const [scheme, n, r, p, saltB64, keyB64] = String(stored).split("$");
    if (scheme !== "scrypt") return false;

    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(keyB64, "base64");
    if (!salt.length || !expected.length) return false;

    const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** A fresh session token. The raw value goes in the cookie and is never stored. */
export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

/** What we actually persist for a session token. */
export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Burn roughly the cost of a real password check.
 * Called when an account does not exist so that "no such user" and "wrong
 * password" take comparable time and cannot be told apart by a stopwatch.
 */
export async function dummyVerify() {
  await scryptAsync("timing-equaliser", randomBytes(SALT_BYTES), KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
}
