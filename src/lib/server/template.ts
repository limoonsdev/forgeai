import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

let cache: { path: string; content: string }[] | null = null;

/** The Next.js starter every project is forged from (runtime/template). */
export async function loadTemplateFiles() {
  if (cache) return cache;
  const root = path.join(process.cwd(), "runtime", "template");
  const out: { path: string; content: string }[] = [];
  async function walk(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else out.push({ path: path.relative(root, abs).split(path.sep).join("/"), content: await fs.readFile(abs, "utf8") });
    }
  }
  await walk(root);
  out.sort((a, b) => a.path.localeCompare(b.path));
  cache = out;
  return out;
}
