// Preview the site locally:  node scripts/serve.mjs   → http://localhost:8000
// (Opening index.html by double-clicking won't load stats: Google blocks
// requests from file:// pages. Any web address, including localhost, works.)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 8000;
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".csv": "text/csv; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon",
};

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const file = path.join(root, decodeURIComponent(pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(port, () => console.log(`Iona Futsal site → http://localhost:${port}  (Ctrl+C to stop)`));
