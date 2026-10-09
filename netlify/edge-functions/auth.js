// Password-protects the whole site, including /api/check.
//
// The password comes from the SITE_PASSWORD environment variable in Netlify.
// When that isn't set, a built-in password is used instead. Only hashes of
// it are stored here, so the repository never contains the password itself:
//   BUILTIN_LOGIN_HASH   = sha256("sherlock-login:" + password)
//   BUILTIN_SESSION_HASH = sha256(sha256("sherlock-session:" + password))
// The session cookie holds sha256("sherlock-session:" + password), which only
// someone who knows the password can compute.

const COOKIE = "sherlock_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const encoder = new TextEncoder();

const BUILTIN_LOGIN_HASH = "4e1d61cc5fe9ba1dc9f848d61697809c2e4d2d1845b5b11495438f225e307f80";
const BUILTIN_SESSION_HASH = "17f8fb1c90218d004e88262ba1c6cce44e3043a5bd2b86c972b6dd256570a705";

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Two interchangeable schemes: one keyed by SITE_PASSWORD, one by the hashes above.
function envScheme(password) {
  return {
    check: async (attempt) => safeEqual(await hmac("cmp", attempt), await hmac("cmp", password)),
    issue: () => makeToken(password),
    verify: (token) => validToken(token, password),
  };
}

const builtinScheme = {
  check: async (attempt) => safeEqual(await sha256(`sherlock-login:${attempt}`), BUILTIN_LOGIN_HASH),
  issue: async (attempt) => `b.${await sha256(`sherlock-session:${attempt}`)}`,
  verify: async (token) =>
    typeof token === "string" &&
    token.startsWith("b.") &&
    safeEqual(await sha256(token.slice(2)), BUILTIN_SESSION_HASH),
};

function getPassword() {
  return globalThis.Netlify?.env.get("SITE_PASSWORD") || "";
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Token is "<expiry>.<hmac>", keyed by the password so changing the password
// signs everyone out.
async function makeToken(password) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  return `${expires}.${await hmac(password, `sherlock:${expires}`)}`;
}

async function validToken(token, password) {
  const [expires, sig] = (token || "").split(".");
  if (!expires || !sig || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(password, `sherlock:${expires}`));
}

function readCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function loginPage({ error = "", next = "/", status = 401 } = {}) {
  const message = error
      ? `<p class="form-error">كلمة المرور غير صحيحة<br><span dir="ltr">Incorrect password</span></p>`
      : "";
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sherlock — تسجيل الدخول</title>
<link rel="icon" type="image/png" href="/logo.png">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="login-page">
<main class="login">
  <img src="/logo.png" alt="" width="72" height="72">
  <h1>Sherlock</h1>
  <p class="lead">أدخل كلمة المرور للمتابعة<br><span dir="ltr">Enter the password to continue</span></p>
  <form method="post" action="/__login" class="search">
    <input type="hidden" name="next" value="${escapeHtml(next)}">
    <div class="search-box">
      <input type="password" name="password" autocomplete="current-password" required autofocus
             aria-label="Password" placeholder="كلمة المرور / Password">
      <button type="submit" class="btn btn-primary">دخول · Sign in</button>
    </div>
    ${message}
  </form>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function safeNext(value) {
  // Only allow same-site relative paths.
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async (req, context) => {
  const url = new URL(req.url);
  const password = getPassword();
  const scheme = password ? envScheme(password) : builtinScheme;

  if (url.pathname === "/__logout") {
    return new Response(null, {
      status: 303,
      headers: { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
    });
  }

  if (url.pathname === "/__login" && req.method === "POST") {
    const form = await req.formData();
    const next = safeNext(form.get("next"));
    const attempt = String(form.get("password") || "");
    if (!(await scheme.check(attempt))) {
      await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
      return loginPage({ error: true, next });
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: next,
        "Set-Cookie": `${COOKIE}=${await scheme.issue(attempt)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (await scheme.verify(readCookie(req, COOKIE))) return context.next();

  if (url.pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return loginPage({ next: url.pathname + url.search });
};

export const config = {
  path: "/*",
  // Public assets the login page itself needs.
  excludedPath: ["/styles.css", "/logo.png", "/fonts/*"],
};
