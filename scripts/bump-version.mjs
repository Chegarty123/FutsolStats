// Run after changing any file in css/ or js/, before uploading:
//   node scripts/bump-version.mjs
// It updates the ?v=… tag on the CSS/JS links in every page, so browsers
// fetch the new files instead of mixing a saved old copy with a new page
// (GitHub Pages lets browsers reuse files for up to 10 minutes).
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, ""); // e.g. 202611101805
const pattern = /((?:href|src)="(?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"/g;

for (const name of await readdir(root)) {
  if (!name.endsWith(".html")) continue;
  const file = path.join(root, name);
  const before = await readFile(file, "utf8");
  const after = before.replace(pattern, `$1?v=${version}"`);
  if (after !== before) {
    await writeFile(file, after);
    console.log(`✓ ${name}`);
  }
}
console.log(`Version set to ${version}`);
