-- LinkFetcher License Server (Cloudflare D1).
-- Criado por `wrangler d1 create linkfetcher-licenses` + aplicado com:
--   wrangler d1 execute linkfetcher-licenses --file=./schema.sql
CREATE TABLE IF NOT EXISTS checkouts (
  checkout_id TEXT PRIMARY KEY,
  mp_id TEXT NOT NULL,
  email TEXT NOT NULL,
  contact TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'mensal',
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

-- Broadcasts do dono (ex.: aviso de update). Tag idempotente: repetir a
-- mesma tag só envia a quem faltou. Aplicar com o mesmo comando do schema.
CREATE TABLE IF NOT EXISTS broadcasts (
  tag TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS broadcast_sends (
  tag TEXT NOT NULL,
  email TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (tag, email)
);
