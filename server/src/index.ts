import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Define Cloudflare Bindings (matching your wrangler.json)
type Bindings = {
  DB: D1Database;
};

type UserInput = { name?: unknown; email?: unknown };

const app = new Hono<{ Bindings: Bindings }>();

const USER_COLUMNS = 'id, name, email, created_at';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Enable CORS
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://client.insovaidev.workers.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Validate and normalise a user payload. Returns an error message or the clean values.
const parseUser = (body: UserInput): { error: string } | { name: string; email: string } => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!name || !email) return { error: 'Name and email are required' };
  if (name.length > 100) return { error: 'Name must be at most 100 characters' };
  if (!EMAIL_RE.test(email)) return { error: 'Email is invalid' };
  return { name, email };
};

const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const isUniqueViolation = (err: unknown) => String((err as Error)?.message).includes('UNIQUE');

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', database: 'Cloudflare D1' });
});

// GET all users from D1
app.get('/api/users', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC, id DESC`
  ).all();

  return c.json({ users: results });
});

// GET one user
app.get('/api/users/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid user id' }, 400);

  const user = await c.env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .bind(id).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  return c.json({ user });
});

// POST create user in D1
app.post('/api/users', async (c) => {
  const body = await c.req.json<UserInput>().catch(() => ({}) as UserInput);
  const input = parseUser(body);
  if ('error' in input) return c.json(input, 400);

  try {
    const user = await c.env.DB.prepare(
      `INSERT INTO users (name, email) VALUES (?, ?) RETURNING ${USER_COLUMNS}`
    ).bind(input.name, input.email).first();

    return c.json({ user }, 201);
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({ error: 'Email already exists' }, 409);
    throw err;
  }
});

// PUT update user
app.put('/api/users/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid user id' }, 400);

  const body = await c.req.json<UserInput>().catch(() => ({}) as UserInput);
  const input = parseUser(body);
  if ('error' in input) return c.json(input, 400);

  try {
    const user = await c.env.DB.prepare(
      `UPDATE users SET name = ?, email = ? WHERE id = ? RETURNING ${USER_COLUMNS}`
    ).bind(input.name, input.email, id).first();
    if (!user) return c.json({ error: 'User not found' }, 404);

    return c.json({ user });
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({ error: 'Email already exists' }, 409);
    throw err;
  }
});

// DELETE user
app.delete('/api/users/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid user id' }, 400);

  const info = await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  if (!info.meta.changes) return c.json({ error: 'User not found' }, 404);

  return c.json({ success: true });
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

export default app;
