# my-fullstack-app — 100% Free Cloudflare Stack

**Hono (Workers) + Cloudflare D1 (SQLite) + Vue 3 (Pages)**

```
my-fullstack-app/
├── backend/            # Cloudflare Worker (Hono API + Cloudflare D1)
│   ├── src/index.ts    # Hono API routes
│   ├── schema.sql      # D1 Database Schema
│   ├── package.json
│   └── wrangler.json   # Cloudflare Worker & D1 config
└── frontend/           # Cloudflare Pages (Vue 3 + Vite)
    ├── src/App.vue
    ├── src/main.ts
    ├── package.json
    └── vite.config.ts
```

## 1. Install

```bash
cd backend  && npm install
cd ../frontend && npm install
```

## 2. Create the D1 database

```bash
cd backend
npx wrangler login
npm run db:create          # = npx wrangler d1 create my-app-db
```

Copy the printed `database_id` into `backend/wrangler.json`
(replace `YOUR_DATABASE_ID_FROM_STEP_1`).

## 3. Run migrations

```bash
npm run db:migrate:local   # local dev database
npm run db:migrate:remote  # production D1 database
```

## 4. Run locally

```bash
# terminal 1
cd backend && npm run dev      # http://localhost:8787

# terminal 2
cd frontend && npm run dev     # http://localhost:5173
```

Local dev works without creating the remote DB first — `wrangler dev` uses a local D1 emulator
(just run `npm run db:migrate:local` once).

## 5. Deploy

**Backend:**
```bash
cd backend && npm run deploy
```

**Frontend:** push to GitHub and connect to **Cloudflare Pages**:
- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://my-backend-api.<your-subdomain>.workers.dev`

Then add your Pages domain to the CORS `origin` list in `backend/src/index.ts` and redeploy the backend.

## API

| Method | Path          | Description                  |
| ------ | ------------- | ---------------------------- |
| GET    | `/api/health` | Health check                 |
| GET    | `/api/users`  | List users                   |
| POST   | `/api/users`  | Create user `{ name, email }` (409 on duplicate email) |

## Free tier

| Component | Free allowance |
| --- | --- |
| D1 (SQLite) | 5 GB storage, 5M row reads/day, 100k row writes/day |
| Workers (Hono) | 100,000 requests/day, 10 ms CPU/request |
| Pages (Vue 3) | Unlimited bandwidth & static requests |
| Custom domains | Free SSL & edge DNS |
