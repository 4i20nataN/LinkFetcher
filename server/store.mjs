// Persistência mínima: um JSON com escrita atômica (tmp + rename).
// Volume baixo (vendas/dia) — quando crescer, trocar por SQLite/Postgres
// mantendo a mesma interface (loadAll/saveAll).
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';

const FILE = process.env.DB_FILE || join(process.cwd(), 'server', 'data', 'db.json');

export function loadAll() {
  try {
    if (!existsSync(FILE)) return { checkouts: {} };
    const db = JSON.parse(readFileSync(FILE, 'utf8'));
    if (!db || typeof db.checkouts !== 'object') return { checkouts: {} };
    return db;
  } catch {
    return { checkouts: {} };
  }
}

export function saveAll(db) {
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, FILE);
}

// Mutex em memória p/ seções loadAll→saveAll: sem ele, dois webhooks/polls
// concorrentes intercalam nos awaits intermediários e um saveAll apaga o
// outro (venda liquidada volta a pending / chave mintada se perde). Node é
// single-thread, então fila de promises basta. Vale p/ 1 réplica — com
// horizontal, externalizar o lock (ou um checkout por arquivo).
let tail = Promise.resolve();
export function withStoreLock(fn) {
  const task = tail.then(fn, fn);
  tail = task.catch(() => {});
  return task;
}
