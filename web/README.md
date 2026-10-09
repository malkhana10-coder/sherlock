# Sherlock Web

A web interface for Sherlock that runs on [Netlify](https://www.netlify.com/):
a static page (`web/src`) plus a Netlify Function (`netlify/functions/check.mjs`)
that checks a username against the sites in `sherlock_project/resources/data.json`
using the same detection rules as the CLI.

## Deploy to Netlify

1. In Netlify, choose **Add new site → Import an existing project** and pick this repository.
2. Leave the build settings empty — `netlify.toml` already sets them
   (`node web/build.mjs`, publish `web/dist`, functions `netlify/functions`).
3. Optionally, under **Project configuration → Environment variables**, add
   `SITE_PASSWORD` to choose the password users must enter. Without it, the
   built-in password (stored only as a hash in `netlify/edge-functions/auth.js`)
   is used.
4. Click **Deploy** (or **Trigger deploy** after adding the variable).

Or with the Netlify CLI:

```sh
npm install -g netlify-cli
netlify login
netlify deploy --build --prod
```

## Local development

```sh
node web/build.mjs   # writes web/dist
netlify dev          # serves the site and the /api/check function
```

## How it works

- `netlify/edge-functions/auth.js` password-protects every page and `/api/check`.
  A successful sign-in sets a signed, HttpOnly cookie valid for 30 days;
  changing `SITE_PASSWORD` signs everyone out. Sign out at `/__logout`.

- `web/build.mjs` copies `web/src` to `web/dist` and writes a slim `sites.json`
  (site names, URLs, NSFW flag, and the CLI's false-positive exclusion list).
- The browser sends sites to `POST /api/check` in batches of 12, several in parallel,
  so each function call stays well inside Netlify's 10-second limit.
- `netlify/lib/detect.mjs` is a port of the detection logic in
  `sherlock_project/sherlock.py` (`status_code`, `message`, `response_url`,
  WAF fingerprints). Usernames are limited to `A-Z a-z 0-9 . _ -` and every
  request URL must stay on the site's own domain.
