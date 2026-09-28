// Cloudflare bindings, vars and secrets (see wrangler.json and README).
export type Env = {
  DB: D1Database;
  // Secrets (wrangler secret put …)
  ADMIN_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  // Vars
  CLAUDE_MODEL?: string;
  GITHUB_REPO_PRIVATE?: string;
  VAPID_SUBJECT?: string;
  DASHBOARD_URL?: string;
  MAX_TARGETS_PER_RUN?: string;
};

export type Target = {
  id: number;
  url: string;
  label: string;
  active: number;
  last_checked_at: string | null;
  last_status: string | null;
  last_error: string | null;
  created_at: string;
};

export type MissingSkill = { skill: string; reason: string };
