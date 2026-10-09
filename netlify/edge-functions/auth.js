// Password-protects the whole site, including /api/check.
// The password is read from the SITE_PASSWORD environment variable in Netlify.
// If it isn't set, the site stays locked rather than open.

const COOKIE = "sherlock_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const encoder = new TextEncoder();

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

function loginPage({ error = "", next = "/", configured = true, status = 401 } = {}) {
  const message = !configured
    ? `<p class="form-error">لم تُضبط كلمة المرور بعد. أضف المتغيّر SITE_PASSWORD في إعدادات Netlify.<br><span dir="ltr">Password not configured. Set SITE_PASSWORD in Netlify.</span></p>`
    : error
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
             aria-label="Password" placeholder="كلمة المرور / Password" ${configured ? "" : "disabled"}>
      <button type="submit" class="btn btn-primary" ${configured ? "" : "disabled"}>دخول · Sign in</button>
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

  if (url.pathname === "/__logout") {
    return new Response(null, {
      status: 303,
      headers: { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
    });
  }

  if (!password) return loginPage({ configured: false, status: 503 });

  if (url.pathname === "/__login" && req.method === "POST") {
    const form = await req.formData();
    const next = safeNext(form.get("next"));
    const attempt = String(form.get("password") || "");
    const ok = safeEqual(await hmac("cmp", attempt), await hmac("cmp", password));
    if (!ok) {
      await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
      return loginPage({ error: true, next });
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: next,
        "Set-Cookie": `${COOKIE}=${await makeToken(password)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (await validToken(readCookie(req, COOKIE), password)) return context.next();

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
