/* Request/response helpers shared by the auth endpoints.
   Written against the Node request/response objects Vercel passes in, and
   works unchanged under scripts/dev-server.mjs. */

const SESSION_COOKIE = "bfss_session";
const SESSION_DAYS = 7;

export { SESSION_COOKIE, SESSION_DAYS };

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

/**
 * Respond to a body that could not be read. A rejected upload means the client
 * may still be sending, so the connection is closed rather than kept alive -
 * otherwise the next request to reuse it fails with ECONNRESET.
 */
export function badBody(req, res, err) {
  const status = err?.statusCode === 413 ? 413 : 400;
  res.setHeader("Connection", "close");
  json(res, status, {
    error: status === 413 ? "payload_too_large" : "bad_request",
    message: status === 413 ? "That request was too large." : "Invalid request.",
  });
  // Stop reading anything further the client is still pushing at us.
  if (typeof req.destroy === "function") req.destroy();
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return json(res, 405, { error: "method_not_allowed", message: "Method not allowed." });
}

/** Read and parse a JSON body, with a hard size cap so a big POST cannot pin memory. */
export async function readJson(req, limitBytes = 16 * 1024) {
  if (req.body && typeof req.body === "object") return req.body;   // Vercel may pre-parse

  // Reject on the declared length first, so an oversized upload is refused
  // before a single byte of it is read.
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > limitBytes) {
    throw Object.assign(new Error("payload too large"), { statusCode: 413 });
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) {
      throw Object.assign(new Error("payload too large"), { statusCode: 413 });
    }
    chunks.push(chunk);
  }
  if (!total) return {};

  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("body must be an object");
    }
    return parsed;
  } catch {
    throw Object.assign(new Error("invalid JSON body"), { statusCode: 400 });
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k) out[k] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function isSecureRequest(req) {
  // Vercel terminates TLS at the edge and forwards the original scheme.
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  if (proto) return proto === "https";
  return Boolean(req.socket && req.socket.encrypted);
}

export function setSessionCookie(req, res, token) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",                                  // unreadable from JavaScript
    "SameSite=Lax",                              // not sent on cross-site POSTs
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(req, res) {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isSecureRequest(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

/** Best-effort client address, used only as a rate-limit bucket. */
export function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket?.remoteAddress || "unknown";
}
