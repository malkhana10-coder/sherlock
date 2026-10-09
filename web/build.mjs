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

// Platforms most used in Saudi Arabia, shown first in their own section.
// `site` refers to an entry in data.json; entries with only `url` can't be
// checked reliably from a server, so the UI shows them as a direct link.
const FEATURED = [
  { site: "Twitter", ar: "إكس (تويتر)", en: "X (Twitter)" },
  { site: "Instagram", ar: "إنستقرام", en: "Instagram" },
  { site: "Snapchat", ar: "سناب شات", en: "Snapchat" },
  { site: "TikTok", ar: "تيك توك", en: "TikTok" },
  { site: "YouTube", ar: "يوتيوب", en: "YouTube" },
  { site: "threads", ar: "ثريدز", en: "Threads" },
  { key: "Facebook", ar: "فيسبوك", en: "Facebook", main: "https://www.facebook.com/", url: "https://www.facebook.com/{}" },
  { site: "Telegram", ar: "تيليجرام", en: "Telegram" },
  { site: "LinkedIn", ar: "لينكدإن", en: "LinkedIn" },
  { site: "Twitch", ar: "تويتش", en: "Twitch" },
  { site: "Kick", ar: "كيك", en: "Kick" },
  { site: "Discord", ar: "ديسكورد", en: "Discord" },
  { key: "Haraj", ar: "حراج", en: "Haraj", main: "https://haraj.com.sa/", url: "https://haraj.com.sa/users/{}" },
  { key: "Mostaql", ar: "مستقل", en: "Mostaql", main: "https://mostaql.com/", url: "https://mostaql.com/u/{}" },
  { key: "Khamsat", ar: "خمسات", en: "Khamsat", main: "https://khamsat.com/", url: "https://khamsat.com/user/{}" },
];

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

const featured = FEATURED.map((f) => {
  if (!f.site) return { key: f.key, ar: f.ar, en: f.en, main: f.main, url: f.url };
  const info = data[f.site];
  if (!info) throw new Error(`Featured site "${f.site}" is missing from data.json`);
  return { key: f.site, site: f.site, ar: f.ar, en: f.en, main: info.urlMain, url: info.url };
});

const pyproject = await readFile(join(root, "pyproject.toml"), "utf8");
const version = pyproject.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? "";

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });
await cp(join(root, "docs", "images", "sherlock-logo.png"), join(dist, "logo.png"));
await writeFile(join(dist, "sites.json"), JSON.stringify({ version, sites, featured }));

console.log(
  `Built web/dist with ${sites.length} sites (${sites.filter((s) => s.excluded).length} excluded).`
);
