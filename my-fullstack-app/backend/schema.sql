-- backend/schema.sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample seed data (OR IGNORE makes re-running the file safe)
INSERT OR IGNORE INTO users (name, email) VALUES
('Alex Johnson', 'alex@example.com'),
('Sophea Chan', 'sophea@example.com');
