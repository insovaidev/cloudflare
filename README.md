# cloudflare — Hono + D1 + Vue 3 on Cloudflare Workers

Two Cloudflare Workers, matching the dashboard:

| Worker   | URL                                     | What it is                          |
| -------- | --------------------------------------- | ----------------------------------- |
| `server` | https://server.insovaidev.workers.dev   | Hono API + Cloudflare D1 (`my-app-db`) |
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
cd server && npm install && npx wrangler login
npx wrangler d1 create my-app-db     # paste database_id into server/wrangler.json
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
| GET    | `/api/users`  | List users |
| POST   | `/api/users`  | Create user `{ name, email }` (409 on duplicate email) |

CORS allows `http://localhost:5173` and `https://client.insovaidev.workers.dev` (see `server/src/index.ts`).

## Free tier

| Component | Free allowance |
| --- | --- |
| D1 (SQLite) | 5 GB storage, 5M row reads/day, 100k row writes/day |
| Workers | 100,000 requests/day, 10 ms CPU/request |
| Static assets | Free, unlimited requests |
