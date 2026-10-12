-- LinkFetcher License Server (Cloudflare D1).
-- Criado por `wrangler d1 create linkfetcher-licenses` + aplicado com:
--   wrangler d1 execute linkfetcher-licenses --file=./schema.sql
CREATE TABLE IF NOT EXISTS checkouts (
  checkout_id TEXT PRIMARY KEY,
  mp_id TEXT NOT NULL,
  email TEXT NOT NULL,
  contact TEXT NOT NULL,
  price REAL NOT NULL,
  days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  license_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_check INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  email_sent INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_checkouts_mp_id ON checkouts (mp_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_status ON checkouts (status);
