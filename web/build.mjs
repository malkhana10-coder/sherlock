// Builds the static site into web/dist: copies web/src and writes a slim
// sites.json manifest generated from sherlock_project/resources/data.json.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "web", "src");
const dist = join(root, "web", "dist");

// Same list the CLI honors by default (see sherlock_project/sites.py).
const EXCLUSIONS_URL =
  "https://raw.githubusercontent.com/sherlock-project/sherlock/refs/heads/exclusions/false_positive_exclusions.txt";

async function fetchExclusions() {
  try {
    const res = await fetch(EXCLUSIONS_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return new Set(text.split("\n").map((s) => s.trim()).filter(Boolean));
  } catch (err) {
    console.warn(`Could not fetch exclusions list (${err.message}); continuing without it.`);
    return new Set();
  }
}

const data = JSON.parse(
  await readFile(join(root, "sherlock_project", "resources", "data.json"), "utf8")
);
const exclusions = await fetchExclusions();

const sites = Object.entries(data)
  .filter(([name, info]) => name !== "$schema" && info && typeof info === "object")
  .map(([name, info]) => ({
    name,
    main: info.urlMain,
    url: info.url,
    nsfw: Boolean(info.isNSFW),
    excluded: exclusions.has(name),
    ...(info.regexCheck ? { regex: info.regexCheck } : {}),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

const pyproject = await readFile(join(root, "pyproject.toml"), "utf8");
const version = pyproject.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? "";

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });
await cp(join(root, "docs", "images", "sherlock-logo.png"), join(dist, "logo.png"));
await writeFile(join(dist, "sites.json"), JSON.stringify({ version, sites }));

console.log(
  `Built web/dist with ${sites.length} sites (${sites.filter((s) => s.excluded).length} excluded).`
);
