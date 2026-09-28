-- D1 schema for the job-gap pipeline. Safe to re-run (IF NOT EXISTS / OR IGNORE).

-- Your baseline tech stack.
CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Job posting URLs the cron scrapes.
CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    last_checked_at DATETIME,
    last_status TEXT,            -- analyzed | unchanged | failed
    last_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One row per analyzed job posting (and its generated project / repo).
CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER REFERENCES targets(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',   -- pending | completed | failed
    error TEXT,
    job_title TEXT,
    company TEXT,
    required_skills TEXT NOT NULL DEFAULT '[]', -- JSON string[]
    missing_skills TEXT NOT NULL DEFAULT '[]',  -- JSON {skill, reason}[]
    project_name TEXT,
    project_title TEXT,
    project_summary TEXT,
    readme TEXT,
    repo_full_name TEXT,
    repo_url TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analyses_target_hash ON analyses (target_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses (created_at);

-- Browsers that opted into Web Push.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Starter stack (edit from the dashboard).
INSERT OR IGNORE INTO skills (name) VALUES
('TypeScript'), ('Vue 3'), ('Hono'), ('Cloudflare Workers'), ('SQL');
