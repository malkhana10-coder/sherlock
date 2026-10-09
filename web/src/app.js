"use strict";

const BATCH_SIZE = 12;
const CONCURRENCY = 6;
const USERNAME_RE = /^[A-Za-z0-9._-]{1,64}$/;

const I18N = {
  ar: {
    pageTitle: "Sherlock — البحث عن الحسابات",
    heroTitle: "اعثر على أي حساب باسم المستخدم",
    heroLead: "ابحث عن اسم مستخدم واحد في أكثر من 400 موقع وشبكة اجتماعية دفعة واحدة.",
    placeholder: "اسم المستخدم",
    search: "ابحث",
    searching: "جارٍ البحث…",
    optNsfw: "تضمين مواقع البالغين (NSFW)",
    optExcluded: "تضمين المواقع غير الموثوقة",
    resultsFor: "النتائج لـ",
    stop: "إيقاف",
    newSearch: "بحث جديد",
    found: "موجود",
    notFound: "غير موجود",
    errors: "تعذّر التحقق",
    all: "الكل",
    checkedOf: (n) => `تم فحص من ${n}`,
    filterSites: "تصفية المواقع…",
    export: "تصدير",
    copyLinks: "نسخ الروابط",
    copied: (n) => `تم نسخ ${n} رابط`,
    nothingToCopy: "لا توجد حسابات لنسخها",
    downloaded: "تم التنزيل",
    how1Title: "أدخل اسم المستخدم",
    how1Text: "نفس الاسم الذي تريد معرفة أين يُستخدم.",
    how2Title: "نفحص مئات المواقع",
    how2Text: "نرسل الطلبات بالتوازي ونحلل الردود بنفس قواعد Sherlock.",
    how3Title: "صدّر النتائج",
    how3Text: "انسخ الروابط أو نزّلها بصيغة CSV أو JSON.",
    disclaimer: "استخدم الأداة بمسؤولية وفي حدود القانون. قد تظهر نتائج خاطئة لأن المواقع تتغير باستمرار.",
    poweredBy: "مبني على",
    toggleTheme: "تبديل المظهر",
    invalidUsername: "اسم المستخدم يقبل الأحرف الإنجليزية والأرقام و . _ - فقط (حتى 64 حرفًا).",
    loadFailed: "تعذّر تحميل قائمة المواقع. أعد تحميل الصفحة.",
    running: (s) => `جارٍ الفحص… ${s} ث`,
    finished: (s) => `اكتمل البحث في ${s} ث`,
    stopped: (s) => `تم الإيقاف بعد ${s} ث`,
    emptyClaimed: "لم يُعثر على حسابات بعد.",
    emptyOther: "لا توجد نتائج هنا.",
    statusClaimed: "موجود",
    statusAvailable: "غير موجود",
    statusError: "غير معروف",
    statusWaf: "محجوب",
    statusIllegal: "اسم غير صالح",
    statusTimeout: "انتهت المهلة",
    version: "الإصدار",
    featuredTitle: "المنصات الأكثر استخدامًا",
    allSitesTitle: "كل المواقع",
    checking: "جارٍ الفحص",
    manualCheck: "تحقق يدويًا",
    openProfile: "فتح الحساب",
    manualHint: "لا يمكن فحص هذه المنصة تلقائيًا، افتح الرابط للتأكد",
  },
  en: {
    pageTitle: "Sherlock — Find accounts by username",
    heroTitle: "Find any account by username",
    heroLead: "Search one username across 400+ social networks and websites at once.",
    placeholder: "username",
    search: "Search",
    searching: "Searching…",
    optNsfw: "Include NSFW sites",
    optExcluded: "Include unreliable sites",
    resultsFor: "Results for",
    stop: "Stop",
    newSearch: "New search",
    found: "Found",
    notFound: "Not found",
    errors: "Errors",
    all: "All",
    checkedOf: (n) => `checked of ${n}`,
    filterSites: "Filter sites…",
    export: "Export",
    copyLinks: "Copy links",
    copied: (n) => `Copied ${n} link${n === 1 ? "" : "s"}`,
    nothingToCopy: "No accounts to copy",
    downloaded: "Downloaded",
    how1Title: "Enter a username",
    how1Text: "The handle you want to trace across the web.",
    how2Title: "We check hundreds of sites",
    how2Text: "Requests run in parallel and are analyzed with Sherlock's own rules.",
    how3Title: "Export the results",
    how3Text: "Copy the links or download them as CSV or JSON.",
    disclaimer: "Use responsibly and lawfully. Results can be wrong because sites change all the time.",
    poweredBy: "Powered by",
    toggleTheme: "Toggle theme",
    invalidUsername: "Usernames may only contain letters, digits, and . _ - (up to 64 characters).",
    loadFailed: "Couldn't load the site list. Please reload the page.",
    running: (s) => `Checking… ${s}s`,
    finished: (s) => `Finished in ${s}s`,
    stopped: (s) => `Stopped after ${s}s`,
    emptyClaimed: "No accounts found yet.",
    emptyOther: "Nothing here.",
    statusClaimed: "Found",
    statusAvailable: "Not found",
    statusError: "Unknown",
    statusWaf: "Blocked",
    statusIllegal: "Invalid name",
    statusTimeout: "Timed out",
    version: "Version",
    featuredTitle: "Most used platforms",
    allSitesTitle: "All sites",
    checking: "Checking",
    manualCheck: "Check manually",
    openProfile: "Open profile",
    manualHint: "This platform can't be checked automatically; open the link to verify",
  },
};

const $ = (sel) => document.querySelector(sel);
const els = {
  form: $("#search-form"),
  input: $("#username"),
  searchBtn: $("#search-btn"),
  formError: $("#form-error"),
  nsfw: $("#opt-nsfw"),
  excluded: $("#opt-excluded"),
  run: $("#run"),
  runUser: $("#run-user"),
  runMeta: $("#run-meta"),
  stopBtn: $("#stop-btn"),
  progress: $("#progress"),
  progressBar: $("#progress-bar"),
  nFound: $("#n-found"),
  nAvailable: $("#n-available"),
  nError: $("#n-error"),
  nChecked: $("#n-checked"),
  nTotalLabel: $("#n-total-label"),
  tabs: document.querySelectorAll(".tab"),
  filter: $("#filter"),
  exportBtn: $("#export-btn"),
  exportMenu: $("#export-menu"),
  results: $("#results"),
  featured: $("#featured"),
  empty: $("#empty"),
  toast: $("#toast"),
  langToggle: $("#lang-toggle"),
  themeToggle: $("#theme-toggle"),
  version: $("#version"),
};

const state = {
  lang: "ar",
  sites: [],
  featured: [],
  version: "",
  run: null,
  filter: "claimed",
  query: "",
};

// ---------- Preferences ----------

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    return null;
  }
}

function t(key, ...args) {
  const value = I18N[state.lang][key] ?? I18N.en[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function applyLang(lang) {
  state.lang = lang;
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === "ar" ? "rtl" : "ltr";
  document.title = t("pageTitle");
  els.langToggle.textContent = lang === "ar" ? "EN" : "ع";
  els.langToggle.setAttribute("aria-label", lang === "ar" ? "English" : "العربية");
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  if (state.version) els.version.textContent = `${t("version")} ${state.version}`;
  if (!els.formError.hidden) els.formError.textContent = t(els.formError.dataset.key);
  if (state.run) {
    updateSearchButton();
    updateStats();
    updateMeta();
    renderResults();
    renderFeatured();
  }
  store("sherlock.lang", lang);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#0d1117" : "#f6f7f9";
  store("sherlock.theme", theme);
}

// ---------- Search ----------

function showError(key) {
  els.formError.dataset.key = key;
  els.formError.textContent = t(key);
  els.formError.hidden = false;
}

function classify(result) {
  if (result.status === "claimed") return "claimed";
  if (result.status === "available" || result.status === "illegal") return "available";
  return "error";
}

function selectedSites() {
  // Featured platforms are always checked, even if flagged as unreliable.
  const featured = new Set(state.featured.map((f) => f.site).filter(Boolean));
  return state.sites.filter(
    (s) => featured.has(s.name) || ((els.nsfw.checked || !s.nsfw) && (els.excluded.checked || !s.excluded))
  );
}

async function checkBatch(username, names, signal) {
  try {
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, sites: names }),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return body.results;
  } catch (err) {
    if (signal.aborted) return null;
    return names.map((site) => ({ site, status: "unknown", error: err.message }));
  }
}

async function startSearch(username) {
  if (state.run && !state.run.finished) state.run.controller.abort();

  const sites = selectedSites();
  const byName = new Map(sites.map((s) => [s.name, s]));
  const controller = new AbortController();
  const run = {
    username,
    controller,
    total: sites.length,
    results: new Map(),
    counts: { claimed: 0, available: 0, error: 0 },
    started: performance.now(),
    ended: null,
    finished: false,
    stopped: false,
    timer: null,
  };
  state.run = run;

  // Featured platforms go first so their section fills in quickly; shuffle the
  // rest so slow sites don't cluster in one batch.
  const featured = new Set(state.featured.map((f) => f.site).filter(Boolean));
  const names = [
    ...sites.filter((s) => featured.has(s.name)).map((s) => s.name),
    ...sites.filter((s) => !featured.has(s.name)).map((s) => s.name).sort(() => Math.random() - 0.5),
  ];
  const batches = [];
  for (let i = 0; i < names.length; i += BATCH_SIZE) batches.push(names.slice(i, i + BATCH_SIZE));

  document.body.classList.add("searching");
  els.run.hidden = false;
  els.run.classList.remove("done");
  els.runUser.textContent = username;
  els.results.replaceChildren();
  renderFeatured();
  setFilter("claimed");
  els.stopBtn.hidden = false;
  updateSearchButton();
  updateStats();
  updateMeta();
  run.timer = setInterval(updateMeta, 500);
  els.run.scrollIntoView({ behavior: "smooth", block: "start" });

  const url = new URL(location.href);
  url.searchParams.set("u", username);
  history.replaceState(null, "", url);

  let next = 0;
  const worker = async () => {
    while (next < batches.length && !controller.signal.aborted) {
      const batch = batches[next++];
      const results = await checkBatch(username, batch, controller.signal);
      if (!results || state.run !== run) return;
      for (const result of results) {
        const site = byName.get(result.site);
        if (!site || run.results.has(result.site)) continue;
        const item = { ...result, main: site.main, group: classify(result) };
        run.results.set(result.site, item);
        run.counts[item.group]++;
        appendResult(item);
      }
      renderFeatured();
      updateStats();
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (state.run !== run) return;
  finishRun(run, controller.signal.aborted);
}

function finishRun(run, stopped) {
  run.finished = true;
  run.stopped = stopped;
  run.ended = performance.now();
  clearInterval(run.timer);
  els.run.classList.add("done");
  els.stopBtn.hidden = true;
  document.title = `${run.counts.claimed} · @${run.username} — Sherlock`;
  updateSearchButton();
  updateStats();
  updateMeta();
  renderResults();
  renderFeatured();
}

function updateSearchButton() {
  const busy = state.run && !state.run.finished;
  els.searchBtn.disabled = Boolean(busy);
  els.searchBtn.querySelector("span").textContent = busy ? t("searching") : t("search");
}

function updateStats() {
  const run = state.run;
  if (!run) return;
  const checked = run.results.size;
  const pct = run.total ? Math.round((checked / run.total) * 100) : 100;
  els.progressBar.style.width = `${run.finished && !run.stopped ? 100 : pct}%`;
  els.progress.setAttribute("aria-valuenow", String(pct));
  els.nFound.textContent = run.counts.claimed;
  els.nAvailable.textContent = run.counts.available;
  els.nError.textContent = run.counts.error;
  els.nChecked.textContent = checked;
  els.nTotalLabel.textContent = t("checkedOf", run.total);
  els.tabs.forEach((tab) => {
    const key = tab.dataset.filter;
    const n = key === "all" ? checked : run.counts[key];
    let count = tab.querySelector(".count");
    if (!count) {
      count = document.createElement("span");
      count.className = "count";
      tab.append(count);
    }
    count.textContent = n;
  });
}

function updateMeta() {
  const run = state.run;
  if (!run) return;
  const seconds = (((run.ended ?? performance.now()) - run.started) / 1000).toFixed(run.finished ? 1 : 0);
  els.runMeta.textContent = !run.finished
    ? t("running", seconds)
    : run.stopped
      ? t("stopped", seconds)
      : t("finished", seconds);
}

// ---------- Rendering ----------

function statusLabel(item) {
  if (item.status === "claimed") return t("statusClaimed");
  if (item.status === "available") return t("statusAvailable");
  if (item.status === "illegal") return t("statusIllegal");
  if (item.status === "waf") return t("statusWaf");
  if (item.error === "Timeout") return t("statusTimeout");
  return t("statusError");
}

function hostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function resultNode(item) {
  const li = document.createElement("li");
  li.className = `result ${item.group}`;
  li.dataset.site = item.site.toLowerCase();

  const icon = document.createElement("span");
  icon.className = "result-icon";
  icon.textContent = item.site[0]?.toUpperCase() ?? "?";
  const host = hostname(item.main);
  if (host) {
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
    img.addEventListener("load", () => icon.replaceChildren(img), { once: true });
  }

  const body = document.createElement("div");
  body.className = "result-body";
  const name = document.createElement("span");
  name.className = "result-name";
  name.dir = "auto";
  name.textContent = item.site;
  body.append(name);

  const link = item.group === "claimed" ? item.url_user : item.main;
  if (link) {
    const a = document.createElement("a");
    a.className = "result-link";
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = link.replace(/^https?:\/\//, "").replace(/\/$/, "");
    body.append(a);
  }

  const badge = document.createElement("span");
  badge.className = `badge ${item.group}`;
  badge.textContent = statusLabel(item);
  if (item.error) badge.title = item.error;
  else if (item.http_status) badge.title = `HTTP ${item.http_status}`;

  li.append(icon, body, badge);
  return li;
}

function featuredState(entry, run) {
  const profile = entry.url.split("{}").join(encodeURIComponent(run.username));
  if (!entry.site) return { group: "error", label: t("manualCheck"), link: profile, hint: t("manualHint") };
  const result = run.results.get(entry.site);
  if (!result) {
    if (run.finished) return { group: "error", label: t("manualCheck"), link: profile };
    return { group: "pending", label: t("checking"), link: profile };
  }
  if (result.status === "illegal") return { group: "available", label: t("statusIllegal"), link: "" };
  if (result.group === "error") {
    return { group: "error", label: t("manualCheck"), link: profile, hint: t("manualHint") };
  }
  return { group: result.group, label: statusLabel(result), link: result.url_user || profile };
}

function renderFeatured() {
  const run = state.run;
  if (!run) return;
  const nodes = state.featured.map((entry) => {
    const info = featuredState(entry, run);
    const li = document.createElement("li");
    li.className = `feat ${info.group}`;

    const icon = document.createElement("span");
    icon.className = "result-icon";
    icon.textContent = entry.en[0];
    const host = hostname(entry.main);
    if (host) {
      const img = document.createElement("img");
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
      img.addEventListener("load", () => icon.replaceChildren(img), { once: true });
    }

    const body = document.createElement("div");
    body.className = "result-body";
    const name = document.createElement("span");
    name.className = "result-name";
    name.textContent = entry[state.lang] || entry.en;
    const badge = document.createElement("span");
    badge.className = `badge ${info.group}`;
    badge.textContent = info.label;
    if (info.hint) badge.title = info.hint;
    body.append(name, badge);
    li.append(icon, body);

    if (info.link) {
      const a = document.createElement("a");
      a.className = "feat-link";
      a.href = info.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", `${t("openProfile")}: ${name.textContent}`);
      a.title = t("openProfile");
      li.append(a);
    }
    return li;
  });
  els.featured.replaceChildren(...nodes);
}

function matches(item) {
  if (state.filter !== "all" && item.group !== state.filter) return false;
  return !state.query || item.site.toLowerCase().includes(state.query);
}

function appendResult(item) {
  if (!matches(item)) return;
  const node = resultNode(item);
  node.classList.add("new");
  els.results.append(node);
  els.empty.hidden = true;
}

function renderResults() {
  const run = state.run;
  if (!run) return;
  const order = { claimed: 0, available: 1, error: 2 };
  const items = [...run.results.values()]
    .filter(matches)
    .sort((a, b) => order[a.group] - order[b.group] || a.site.localeCompare(b.site, "en", { sensitivity: "base" }));
  els.results.replaceChildren(...items.map(resultNode));
  els.empty.hidden = items.length > 0;
  els.empty.textContent = state.filter === "claimed" && !state.query ? t("emptyClaimed") : t("emptyOther");
}

function setFilter(filter) {
  state.filter = filter;
  els.tabs.forEach((tab) => {
    const active = tab.dataset.filter === filter;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  renderResults();
}

// ---------- Export ----------

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (els.toast.hidden = true), 2200);
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(t("downloaded"));
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportAs(kind) {
  const run = state.run;
  if (!run) return;
  const all = [...run.results.values()].sort((a, b) => a.site.localeCompare(b.site, "en", { sensitivity: "base" }));
  const found = all.filter((r) => r.group === "claimed");
  const base = `sherlock-${run.username}`;

  if (kind === "copy") {
    if (!found.length) return toast(t("nothingToCopy"));
    try {
      await navigator.clipboard.writeText(found.map((r) => r.url_user).join("\n"));
      toast(t("copied", found.length));
    } catch {
      download(`${base}.txt`, found.map((r) => r.url_user).join("\n") + "\n", "text/plain");
    }
  } else if (kind === "txt") {
    const lines = found.map((r) => r.url_user);
    lines.push(`Total Websites Username Detected On : ${found.length}`);
    download(`${base}.txt`, lines.join("\n") + "\n", "text/plain");
  } else if (kind === "csv") {
    const header = ["username", "name", "url_main", "url_user", "exists", "http_status", "response_time_ms"];
    const rows = all.map((r) =>
      [run.username, r.site, r.main, r.url_user, r.status, r.http_status ?? "", r.ms ?? ""].map(csvCell).join(",")
    );
    download(`${base}.csv`, [header.join(","), ...rows].join("\n") + "\n", "text/csv");
  } else if (kind === "json") {
    const data = {
      username: run.username,
      generated: new Date().toISOString(),
      results: all.map(({ site, main, url_user, status, http_status, ms, error }) => ({
        site, url_main: main, url_user, status, http_status, response_time_ms: ms, error,
      })),
    };
    download(`${base}.json`, JSON.stringify(data, null, 2), "application/json");
  }
}

// ---------- Wiring ----------

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = els.input.value.trim().replace(/^@/, "");
  if (!USERNAME_RE.test(username)) return showError("invalidUsername");
  if (!state.sites.length) return showError("loadFailed");
  els.formError.hidden = true;
  startSearch(username);
});

els.input.addEventListener("input", () => (els.formError.hidden = true));

els.stopBtn.addEventListener("click", () => {
  if (state.run && !state.run.finished) state.run.controller.abort();
});

els.tabs.forEach((tab) => tab.addEventListener("click", () => setFilter(tab.dataset.filter)));

els.filter.addEventListener("input", () => {
  state.query = els.filter.value.trim().toLowerCase();
  renderResults();
});

els.exportBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = els.exportMenu.hidden;
  els.exportMenu.hidden = !open;
  els.exportBtn.setAttribute("aria-expanded", String(open));
});
els.exportMenu.addEventListener("click", (event) => {
  const kind = event.target.closest("[data-export]")?.dataset.export;
  if (!kind) return;
  els.exportMenu.hidden = true;
  els.exportBtn.setAttribute("aria-expanded", "false");
  exportAs(kind);
});
document.addEventListener("click", () => {
  els.exportMenu.hidden = true;
  els.exportBtn.setAttribute("aria-expanded", "false");
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") els.exportMenu.hidden = true;
});

els.langToggle.addEventListener("click", () => applyLang(state.lang === "ar" ? "en" : "ar"));
els.themeToggle.addEventListener("click", () =>
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
);

async function init() {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  applyTheme(store("sherlock.theme") || (prefersDark ? "dark" : "light"));
  const savedLang = store("sherlock.lang");
  applyLang(savedLang === "en" || savedLang === "ar" ? savedLang : navigator.language?.startsWith("ar") === false ? "en" : "ar");

  try {
    const res = await fetch("/sites.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.sites = data.sites;
    state.featured = data.featured || [];
    state.version = data.version;
    els.version.textContent = `${t("version")} ${data.version}`;
  } catch {
    showError("loadFailed");
    return;
  }

  const initial = new URLSearchParams(location.search).get("u");
  if (initial && USERNAME_RE.test(initial)) {
    els.input.value = initial;
    startSearch(initial);
  } else {
    els.input.focus();
  }
}

init();
