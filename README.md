# cloudflare — Hono + D1 + Vue 3 on Cloudflare Workers

Two Cloudflare Workers, matching the dashboard:

| Worker   | URL                                     | What it is                          |
| -------- | --------------------------------------- | ----------------------------------- |
| `server` | https://server.insovaidev.workers.dev   | Hono API + Cloudflare D1 (`My-cloudflare`) |
| `client` | https://client.insovaidev.workers.dev   | Vue 3 + Vite SPA (static assets)    |

```
.
├── server/             # Worker "server" (Hono API + D1)
│   ├── src/index.ts    # API routes
│   ├── schema.sql      # D1 schema + seed data
│   ├── package.json
│   └── wrangler.json   # Worker + D1 binding
└── client/             # Worker "client" (Vue 3 static site)
    ├── src/App.vue
    ├── src/main.ts
    ├── .env.production # VITE_API_URL → server worker
    ├── package.json
    ├── vite.config.ts
    └── wrangler.json   # serves ./dist as an SPA
```

## First-time setup

```bash
cd server && npm install && npx wrangler login   # or export CLOUDFLARE_API_TOKEN
npm run deploy                       # uses D1 database My-cloudflare (id in server/wrangler.json)
npm run db:migrate:remote            # create tables + seed users
```

## Deploy

```bash
cd server && npm run deploy          # → server.insovaidev.workers.dev
cd ../client && npm install && npm run deploy   # builds, → client.insovaidev.workers.dev
```

## Local development

```bash
cd server && npm run db:migrate:local && npm run dev   # http://localhost:8787
cd client && npm run dev                               # http://localhost:5173
```

## API

| Method | Path          | Description |
| ------ | ------------- | ----------- |
| GET    | `/api/health` | Health check |
| GET    | `/api/users`      | List users |
| GET    | `/api/users/:id`  | Get one user (404 if missing) |
| POST   | `/api/users`      | Create user `{ name, email }` → 201 (409 on duplicate email) |
| PUT    | `/api/users/:id`  | Update user `{ name, email }` (404 / 409) |
| DELETE | `/api/users/:id`  | Delete user (404 if missing) |

Emails are trimmed, lower-cased and validated; invalid input returns 400.

A Cloudflare API token needs **Workers Scripts: Edit** and **D1: Edit** (account level) to deploy.

CORS allows `http://localhost:5173` and `https://client.insovaidev.workers.dev` (see `server/src/index.ts`).

## Free tier

| Component | Free allowance |
| --- | --- |
| D1 (SQLite) | 5 GB storage, 5M row reads/day, 100k row writes/day |
| Workers | 100,000 requests/day, 10 ms CPU/request |
| Static assets | Free, unlimited requests |
