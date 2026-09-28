import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Target } from './env';
import { processTarget, runAll } from './pipeline';
import { broadcastPush } from './webpush';

const app = new Hono<{ Bindings: Env }>();

const ANALYSIS_LIST_COLUMNS = `id, target_id, url, status, error, job_title, company, required_skills,
  missing_skills, project_name, project_title, project_summary, repo_full_name, repo_url, pinned, created_at`;

app.use('*', cors({
  origin: ['http://localhost:5173', 'https://client.insovaidev.workers.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const isUniqueViolation = (err: unknown) => String((err as Error)?.message).includes('UNIQUE');

const readJson = <T>(c: { req: { json: <U>() => Promise<U> } }) =>
  c.req.json<T>().catch(() => ({}) as T);

const parseUrl = (raw: unknown) => {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

// Stored JSON columns come back as strings; parse them for the client.
const hydrateAnalysis = (row: Record<string, unknown>) => ({
  ...row,
  required_skills: JSON.parse((row.required_skills as string) || '[]'),
  missing_skills: JSON.parse((row.missing_skills as string) || '[]'),
  pinned: Boolean(row.pinned),
});

// ---------- Public ----------

app.get('/api/health', (c) => c.json({ status: 'ok', database: 'Cloudflare D1' }));

app.get('/api/push/public-key', (c) => {
  if (!c.env.VAPID_PUBLIC_KEY) return c.json({ error: 'VAPID keys are not configured' }, 503);
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY });
});

// ---------- Everything else requires the admin token ----------

const tokensMatch = (a: string, b: string) => {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
};

app.use('/api/*', async (c, next) => {
  if (!c.env.ADMIN_TOKEN) return c.json({ error: 'ADMIN_TOKEN is not configured on the server' }, 503);
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!tokensMatch(token, c.env.ADMIN_TOKEN)) return c.json({ error: 'Unauthorized' }, 401);
  await next();
});

app.get('/api/status', (c) => c.json({
  claude: Boolean(c.env.ANTHROPIC_API_KEY),
  github: Boolean(c.env.GITHUB_TOKEN),
  push: Boolean(c.env.VAPID_PUBLIC_KEY && c.env.VAPID_PRIVATE_KEY),
}));

// Skills (your baseline stack)

app.get('/api/skills', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name, created_at FROM skills ORDER BY name COLLATE NOCASE').all();
  return c.json({ skills: results });
});

app.post('/api/skills', async (c) => {
  const body = await readJson<{ name?: unknown }>(c);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 60) return c.json({ error: 'Skill name must be 1-60 characters' }, 400);
  try {
    const skill = await c.env.DB.prepare('INSERT INTO skills (name) VALUES (?) RETURNING id, name, created_at')
      .bind(name).first();
    return c.json({ skill }, 201);
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({ error: 'Skill already exists' }, 409);
    throw err;
  }
});

app.delete('/api/skills/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid skill id' }, 400);
  const info = await c.env.DB.prepare('DELETE FROM skills WHERE id = ?').bind(id).run();
  if (!info.meta.changes) return c.json({ error: 'Skill not found' }, 404);
  return c.json({ success: true });
});

// Targets (job posting URLs)

app.get('/api/targets', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM analyses a WHERE a.target_id = t.id) AS analysis_count
     FROM targets t ORDER BY t.created_at DESC, t.id DESC`,
  ).all();
  return c.json({ targets: results.map((t) => ({ ...t, active: Boolean(t.active) })) });
});

app.post('/api/targets', async (c) => {
  const body = await readJson<{ url?: unknown; label?: unknown }>(c);
  const url = parseUrl(body.url);
  if (!url) return c.json({ error: 'A valid http(s) URL is required' }, 400);
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 120) : '';
  try {
    const target = await c.env.DB.prepare('INSERT INTO targets (url, label) VALUES (?, ?) RETURNING *')
      .bind(url, label).first();
    return c.json({ target }, 201);
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({ error: 'This URL is already tracked' }, 409);
    throw err;
  }
});

app.patch('/api/targets/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid target id' }, 400);
  const body = await readJson<{ label?: unknown; active?: unknown }>(c);

  const sets: string[] = [];
  const values: unknown[] = [];
  if (typeof body.label === 'string') { sets.push('label = ?'); values.push(body.label.trim().slice(0, 120)); }
  if (typeof body.active === 'boolean') { sets.push('active = ?'); values.push(body.active ? 1 : 0); }
  if (!sets.length) return c.json({ error: 'Nothing to update' }, 400);

  const target = await c.env.DB.prepare(`UPDATE targets SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .bind(...values, id).first();
  if (!target) return c.json({ error: 'Target not found' }, 404);
  return c.json({ target });
});

app.delete('/api/targets/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid target id' }, 400);
  const info = await c.env.DB.prepare('DELETE FROM targets WHERE id = ?').bind(id).run();
  if (!info.meta.changes) return c.json({ error: 'Target not found' }, 404);
  return c.json({ success: true });
});

// Run the pipeline on demand for one target (?force=1 re-analyzes unchanged pages).
app.post('/api/targets/:id/run', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid target id' }, 400);
  const target = await c.env.DB.prepare('SELECT * FROM targets WHERE id = ?').bind(id).first<Target>();
  if (!target) return c.json({ error: 'Target not found' }, 404);
  return c.json({ result: await processTarget(c.env, target, c.req.query('force') === '1') });
});

// Same as the cron job, on demand.
app.post('/api/run', async (c) => c.json({ results: await runAll(c.env, c.req.query('force') === '1') }));

// Analyses (job listings + gaps + generated repos)

app.get('/api/analyses', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ${ANALYSIS_LIST_COLUMNS} FROM analyses ORDER BY pinned DESC, created_at DESC, id DESC LIMIT 200`,
  ).all();
  return c.json({ analyses: results.map(hydrateAnalysis) });
});

app.get('/api/analyses/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid analysis id' }, 400);
  const row = await c.env.DB.prepare('SELECT * FROM analyses WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Analysis not found' }, 404);
  return c.json({ analysis: hydrateAnalysis(row) });
});

app.patch('/api/analyses/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid analysis id' }, 400);
  const body = await readJson<{ pinned?: unknown }>(c);
  if (typeof body.pinned !== 'boolean') return c.json({ error: 'pinned must be a boolean' }, 400);
  const info = await c.env.DB.prepare('UPDATE analyses SET pinned = ? WHERE id = ?').bind(body.pinned ? 1 : 0, id).run();
  if (!info.meta.changes) return c.json({ error: 'Analysis not found' }, 404);
  return c.json({ success: true });
});

app.delete('/api/analyses/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid analysis id' }, 400);
  const info = await c.env.DB.prepare('DELETE FROM analyses WHERE id = ?').bind(id).run();
  if (!info.meta.changes) return c.json({ error: 'Analysis not found' }, 404);
  return c.json({ success: true });
});

// Web Push subscriptions

app.post('/api/push/subscribe', async (c) => {
  const body = await readJson<{ endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }>(c);
  const endpoint = parseUrl(body.endpoint);
  const { p256dh, auth } = body.keys ?? {};
  if (!endpoint || !endpoint.startsWith('https:') || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return c.json({ error: 'Invalid push subscription' }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
  ).bind(endpoint, p256dh, auth).run();
  return c.json({ success: true }, 201);
});

app.post('/api/push/unsubscribe', async (c) => {
  const body = await readJson<{ endpoint?: unknown }>(c);
  if (typeof body.endpoint !== 'string') return c.json({ error: 'endpoint is required' }, 400);
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(body.endpoint).run();
  return c.json({ success: true });
});

app.post('/api/push/test', async (c) => {
  if (!c.env.VAPID_PUBLIC_KEY || !c.env.VAPID_PRIVATE_KEY) return c.json({ error: 'VAPID keys are not configured' }, 503);
  const result = await broadcastPush(c.env, {
    title: 'Notifications are on',
    body: 'You will be notified when a new project repo is created.',
    url: c.env.DASHBOARD_URL || '/',
    tag: 'test',
  });
  return c.json(result);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

export default {
  fetch: app.fetch,
  // Cron Trigger (schedule in wrangler.json)
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runAll(env).then((results) => console.log('cron run', JSON.stringify(results))));
  },
} satisfies ExportedHandler<Env>;
