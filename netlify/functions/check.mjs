import data from "../../sherlock_project/resources/data.json" with { type: "json" };
import { checkSite, USERNAME_RE } from "../lib/detect.mjs";

// Netlify ends synchronous functions after ~10s, so each call checks a small
// batch of sites in parallel and every request has its own timeout.
const MAX_SITES_PER_CALL = 15;
const REQUEST_TIMEOUT_MS = 8000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const username = String(payload?.username ?? "").trim();
  if (!USERNAME_RE.test(username)) return json({ error: "Invalid username" }, 400);

  const sites = Array.isArray(payload?.sites) ? payload.sites : [];
  if (sites.length === 0 || sites.length > MAX_SITES_PER_CALL) {
    return json({ error: `Send between 1 and ${MAX_SITES_PER_CALL} sites` }, 400);
  }

  const results = await Promise.all(
    sites.map((name) => {
      const info = typeof name === "string" && name !== "$schema" ? data[name] : undefined;
      if (!info || typeof info !== "object") {
        return { site: String(name), status: "unknown", error: "Unknown site" };
      }
      return checkSite(name, info, username, { timeoutMs: REQUEST_TIMEOUT_MS });
    })
  );

  return json({ username, results });
};

export const config = { path: "/api/check" };
