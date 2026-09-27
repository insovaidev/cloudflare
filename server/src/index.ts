import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Define Cloudflare Bindings (matching your wrangler.json)
type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://client.insovaidev.workers.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', database: 'Cloudflare D1' });
});

// GET all users from D1
app.get('/api/users', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, email, created_at FROM users ORDER BY created_at DESC, id DESC"
    ).all();

    return c.json({ users: results });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST create user in D1
app.post('/api/users', async (c) => {
  try {
    const body = await c.req.json<{ name: string; email: string }>();

    if (!body.name || !body.email) {
      return c.json({ error: 'Name and email are required' }, 400);
    }

    const info = await c.env.DB.prepare(
      "INSERT INTO users (name, email) VALUES (?, ?)"
    ).bind(body.name, body.email).run();

    return c.json({ success: true, id: info.meta.last_row_id }, 201);
  } catch (err: any) {
    if (String(err.message).includes('UNIQUE')) {
      return c.json({ error: 'Email already exists' }, 409);
    }
    return c.json({ error: err.message }, 500);
  }
});

export default app;
