// Port of the detection logic in sherlock_project/sherlock.py to run inside
// a Netlify Function. Keep the semantics in sync with the Python version.

export const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0";

// Only characters that cannot change the host or path structure of a site URL.
export const USERNAME_RE = /^[A-Za-z0-9._-]{1,64}$/;

// Headers that fetch() refuses to set or that would break the request.
const FORBIDDEN_HEADERS = new Set(["host", "content-length", "connection"]);

// Same fingerprints as WAFHitMsgs in sherlock.py.
const WAF_HIT_MSGS = [
  ".loading-spinner{visibility:hidden}body.no-js .challenge-running{display:none}body.dark{background-color:#222;color:#d9d9d9}body.dark a{color:#fff}body.dark a:hover{color:#ee730a;text-decoration:underline}body.dark .lds-ring div{border-color:#999 transparent transparent}body.dark .font-red{color:#b20f03}body.dark", // 2024-05-13 Cloudflare
  '<span id="challenge-error-text">', // 2024-11-11 Cloudflare error page
  "AwsWafIntegration.forceRefreshToken", // 2024-11-11 Cloudfront (AWS)
  '{return l.onPageView}}),Object.defineProperty(r,"perimeterxIdentifiers",{enumerable:', // 2024-04-09 PerimeterX / Human Security
];

export const Status = {
  CLAIMED: "claimed",
  AVAILABLE: "available",
  UNKNOWN: "unknown",
  ILLEGAL: "illegal",
  WAF: "waf",
};

export function interpolate(input, username) {
  if (typeof input === "string") return input.split("{}").join(username);
  if (Array.isArray(input)) return input.map((i) => interpolate(i, username));
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, interpolate(v, username)])
    );
  }
  return input;
}

function hostOf(template) {
  try {
    return new URL(interpolate(template, "placeholder")).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// The username is restricted by USERNAME_RE, but double check that the
// interpolated URL still points at the site's own domain.
function sameSite(template, url) {
  const expected = hostOf(template);
  if (!expected) return false;
  const base = expected.replace(/^placeholder\./, "");
  let actual;
  try {
    actual = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return actual === expected || actual === base || actual.endsWith("." + base);
}

function regexAllows(regexCheck, username) {
  if (!regexCheck) return true;
  try {
    return new RegExp(regexCheck).test(username);
  } catch {
    // Python-only syntax: let the site decide.
    return true;
  }
}

function toList(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export async function checkSite(name, info, username, { timeoutMs = 8000 } = {}) {
  const url = interpolate(info.url, username.replace(/ /g, "%20"));
  const result = { site: name, url_main: info.urlMain, url_user: url };

  if (!regexAllows(info.regexCheck, username)) {
    return { ...result, url_user: "", status: Status.ILLEGAL };
  }

  const probe = info.urlProbe ? interpolate(info.urlProbe, username) : url;
  if (!sameSite(info.urlProbe || info.url, probe)) {
    return { ...result, status: Status.UNKNOWN, error: "Blocked URL" };
  }

  const errorTypes = toList(info.errorType);
  const needsBody = errorTypes.includes("message");

  let method = info.request_method;
  if (!method) method = errorTypes.includes("status_code") && !needsBody ? "HEAD" : "GET";

  const headers = { "User-Agent": USER_AGENT };
  for (const [k, v] of Object.entries(info.headers || {})) {
    if (!FORBIDDEN_HEADERS.has(k.toLowerCase())) headers[k] = v;
  }

  let body;
  if (info.request_payload !== undefined) {
    body = JSON.stringify(interpolate(info.request_payload, username));
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  let response;
  let text = "";
  try {
    response = await fetch(probe, {
      method,
      headers,
      body,
      redirect: errorTypes.includes("response_url") ? "manual" : "follow",
      signal: controller.signal,
    });
    if (method !== "HEAD") text = await response.text();
  } catch (err) {
    clearTimeout(timer);
    const error = err?.name === "AbortError" ? "Timeout" : "Connection error";
    return { ...result, status: Status.UNKNOWN, error, ms: Date.now() - started };
  }
  clearTimeout(timer);

  const http = response.status;
  const base = { ...result, http_status: http, ms: Date.now() - started };

  if (WAF_HIT_MSGS.some((msg) => text.includes(msg))) {
    return { ...base, status: Status.WAF, error: "Blocked by WAF" };
  }

  if (errorTypes.some((t) => !["message", "status_code", "response_url"].includes(t))) {
    return { ...base, status: Status.UNKNOWN, error: "Unknown error type" };
  }

  let status = Status.UNKNOWN;

  if (errorTypes.includes("message")) {
    const found = toList(info.errorMsg).some((msg) => text.includes(msg));
    status = found ? Status.AVAILABLE : Status.CLAIMED;
  }

  if (errorTypes.includes("status_code") && status !== Status.AVAILABLE) {
    const codes = toList(info.errorCode);
    status = Status.CLAIMED;
    if (codes.includes(http) || http >= 300 || http < 200) status = Status.AVAILABLE;
  }

  if (errorTypes.includes("response_url") && status !== Status.AVAILABLE) {
    status = http >= 200 && http < 300 ? Status.CLAIMED : Status.AVAILABLE;
  }

  return { ...base, status };
}
