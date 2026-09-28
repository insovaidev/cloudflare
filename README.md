# Skill Gap — job postings → side-projects → GitHub repos

An automated pipeline on Cloudflare: a cron Worker scrapes job postings, Workers AI (free tier) compares each
one with your tech stack, designs a side-project that closes the gaps, a new GitHub repo is created with the generated
`README.md`, and your browser gets a Web Push notification. A Vue 3 dashboard (styled after Apple Notes)
lets you manage it all.

| Worker   | URL                                   | What it is                                           |
| -------- | ------------------------------------- | ---------------------------------------------------- |
| `server` | https://server.insovaidev.workers.dev | Hono API + Cron Trigger + D1 (`My-cloudflare`)       |
| `client` | https://client.insovaidev.workers.dev | Vue 3 dashboard + service worker (`sw.js`)           |

## How it works

```
Cron Trigger (every 6h)                                      Vue 3 dashboard
      │                                                     (skills, targets, projects,
      ▼                                                      push opt-in) ── Hono API ──┐
 server Worker ── fetch job URL ── HTML → text ── SHA-256 (skip if unchanged)            │
      │                                                                                  ▼
      ├─ read skills from D1 ── Workers AI (JSON: gaps + project + README) ──►  D1
      ├─ GitHub REST: POST /user/repos → PUT README.md (initial commit)
      └─ Web Push (VAPID + aes128gcm) ──► service worker ──► native notification → repo link
```

1. **Trigger & scraping** — `scheduled()` in `server/src/index.ts` runs `runAll()` (`server/src/pipeline.ts`), which
   picks up to `MAX_TARGETS_PER_RUN` active targets (least recently checked first) and fetches each page
   (`server/src/scrape.ts`). A posting whose text hash was already analyzed is skipped.
2. **Skill analysis** — `server/src/analyze.ts` sends your stack (the `skills` table) plus the posting to
   Cloudflare Workers AI (Llama 3.3 70B by default) in JSON mode, asking for: job title, company, required skills, missing skills with reasons, a
   project name/title/summary and a complete README.
3. **Repo creation** — `server/src/github.ts` creates the repo (private by default) and commits `README.md` as the
   first commit. Name clashes get a short suffix.
4. **Web Push** — `server/src/webpush.ts` signs a VAPID JWT and encrypts the payload (RFC 8291) using WebCrypto
   only, then notifies every subscribed browser. Expired subscriptions are removed.
5. **Dashboard** — `client/` manages skills and target URLs, registers `public/sw.js`, handles push permission, and
   lists every analysis with its gaps, rendered README and repo link.

## Project layout

```
server/
  src/index.ts        Hono routes + cron entry point
  src/pipeline.ts     scrape → Workers AI → GitHub → push
  src/scrape.ts       fetch + HTML-to-text + hash
  src/analyze.ts      Workers AI call (JSON mode)
  src/github.ts       repo + README commit
  src/webpush.ts      VAPID + aes128gcm on WebCrypto
  schema.sql          D1 tables (skills, targets, analyses, push_subscriptions)
  scripts/generate-vapid.mjs
  wrangler.json       cron schedule, vars, D1 binding
client/
  src/App.vue         split-view shell (folders | list | detail), phone push-navigation
  src/components/     Sidebar, ProjectList, ProjectDetail, StackPane, TargetsPane, SettingsPane, LockScreen
  src/lib/            api, store, push, markdown (sanitized), formatting
  public/sw.js        push + notificationclick handlers
```

## Setup

### 1. Secrets

| Secret              | What it is |
| ------------------- | ---------- |
| `ADMIN_TOKEN`       | Any long random string. The dashboard asks for it once per browser; every API route except `/api/health` and `/api/push/public-key` requires it. |
| `GITHUB_TOKEN`      | Fine-grained PAT with *All repositories* → **Administration: Read and write** and **Contents: Read and write** (or a classic PAT with `repo`). |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Generate with `npm run vapid`. |

```bash
cd server && npm install
npm run vapid                               # prints both VAPID keys
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

### 2. Database and deploy

```bash
cd server
npm run db:migrate:remote        # creates the tables (safe to re-run)
npm run deploy                   # → server.insovaidev.workers.dev (cron included)
cd ../client && npm install && npm run deploy   # → client.insovaidev.workers.dev
```

Open the dashboard, enter your `ADMIN_TOKEN`, add your skills under **My Stack**, add job posting URLs under
**Job Targets**, and turn on notifications under **Settings**. Tap the orange button on **Projects** to run the
pipeline immediately instead of waiting for the cron.

### Configuration (`server/wrangler.json`)

| Setting | Default | Notes |
| --- | --- | --- |
| `triggers.crons` | `0 */6 * * *` | Cron schedule (UTC). |
| `AI_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Workers AI model used for analysis (the `AI` binding needs no key). |
| `GITHUB_REPO_PRIVATE` | `true` | Set to `false` to create public repos. |
| `VAPID_SUBJECT` | `mailto:…` | Contact for push services. |
| `DASHBOARD_URL` | client URL | Used for the notification's “Dashboard” action. |
| `MAX_TARGETS_PER_RUN` | `5` | Targets processed per run (keeps within Worker subrequest limits). |

## Local development

```bash
cd server
cp .dev.vars.example .dev.vars     # fill in real values
npm run db:migrate:local
npm run dev                        # http://localhost:8787 (with --test-scheduled)
npm run cron:test                  # fire the cron handler once

cd client && npm run dev           # http://localhost:5173
```

Web Push needs HTTPS or `localhost`; the service worker is served from `client/public/sw.js`.

## API

All routes except the first two need `Authorization: Bearer <ADMIN_TOKEN>`.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/health` | Health check |
| GET | `/api/push/public-key` | VAPID public key for `pushManager.subscribe` |
| GET | `/api/status` | Which secrets are configured |
| GET / POST / DELETE | `/api/skills`, `/api/skills/:id` | Your stack `{ name }` |
| GET / POST | `/api/targets` | Job URLs `{ url, label? }` |
| PATCH / DELETE | `/api/targets/:id` | `{ label?, active? }` |
| POST | `/api/targets/:id/run[?force=1]` | Run the pipeline for one URL now (`force` re-analyzes unchanged pages) |
| POST | `/api/run[?force=1]` | Same as the cron run |
| GET | `/api/analyses`, `/api/analyses/:id` | Analyses (detail includes the README) |
| PATCH / DELETE | `/api/analyses/:id` | `{ pinned }` / delete (the GitHub repo is kept) |
| POST | `/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/test` | Manage Web Push subscriptions |

## Notes and limits

- Pages that render with JavaScript or sit behind a login return little text and are marked *failed*. Postings
  longer than 24k characters are truncated to fit the model's context window (the prompt says so).
- The job page is untrusted input: the prompt tells the model to treat it as data, and the README is sanitized with
  DOMPurify before the dashboard renders it.
- Each analysis makes one Workers AI call. The free tier (10,000 neurons/day) covers a few analyses a day; beyond
  that Workers AI bills per use on the paid Workers plan. Unchanged pages cost nothing beyond the fetch.
- The Claude API integration was removed; the model is open-weight, so gap analysis and READMEs are less
  polished than a frontier model's.
- The Cloudflare API token used for deploys needs **Workers Scripts: Edit**, **D1: Edit** and **Workers AI: Read**.
