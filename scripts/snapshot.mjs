// Downloads each sheet tab into data/<tab>.csv.
// The site uses these as a backup if Google can't be reached.
// Run locally with:  node scripts/snapshot.mjs
// (The GitHub Action in .github/workflows/snapshot.yml runs it hourly.)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Reuse the site's own config so the URLs live in exactly one place.
const window = {};
new Function("window", await readFile(path.join(root, "js/config.js"), "utf8"))(window);
const { sheet } = window.FUTSAL_CONFIG;

await mkdir(path.join(root, "data"), { recursive: true });

let failed = 0;
for (const [tab, gid] of Object.entries(sheet.tabs)) {
  const url = `${sheet.base}?gid=${gid}&single=true&output=csv`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (/^\s*</.test(text)) throw new Error("got HTML instead of CSV — is the sheet still published?");
    await writeFile(path.join(root, "data", `${tab}.csv`), text);
    console.log(`✓ ${tab}: ${text.split("\n").length} lines`);
  } catch (err) {
    failed++;
    console.error(`✗ ${tab}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
