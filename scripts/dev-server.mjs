/* Local development server: serves the static site and routes /api/* to the
   same handler modules Vercel runs in production.
   Usage:  DATABASE_URL=... npm run dev   */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = Number(process.env.PORT || 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

async function serveApi(req, res, route) {
  // Only routes that exist on disk under api/, and never the _lib helpers.
  const rel = normalize(route.replace(/^\/api\//, "")).replace(/^(\.\.[/\\])+/, "");
  if (!rel || rel.startsWith("_") || rel.includes("/_")) return false;

  const file = join(ROOT, "api", `${rel}.js`);
  try {
    await stat(file);
  } catch {
    return false;
  }
  // Cache-bust so edits are picked up without restarting the server.
  const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  await mod.default(req, res);
  return true;
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";

  // Contain every request inside the project directory.
  const target = resolve(ROOT, normalize(rel));
  if (!target.startsWith(ROOT)) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }

  const candidates = [target];
  if (!extname(target)) candidates.push(`${target}.html`);   // /login -> login.html

  for (const file of candidates) {
    try {
      const info = await stat(file);
      if (!info.isFile()) continue;
      const body = await readFile(file);
      res.statusCode = 200;
      res.setHeader("Content-Type", TYPES[extname(file).toLowerCase()] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      return res.end(body);
    } catch { /* try the next candidate */ }
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end("<h1>404</h1><p>Not found.</p>");
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (pathname.startsWith("/api/")) {
      if (await serveApi(req, res, pathname)) return;
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "not_found" }));
    }
    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error("[dev]", err);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Server error");
  }
});

server.listen(PORT, () => {
  console.log(`Bright Future dev server on http://localhost:${PORT}`);
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set - the site will serve, but /api/auth/* returns 503.");
  }
});
