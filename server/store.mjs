// Checkouts em JSON com escrita atômica (tmp+rename).
// Mantém a interface (loadAll/saveAll) se migrar p/ SQLite.
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

// Mutex em memória p/ loadAll→saveAll (fila de promises; 1 réplica).
// Com réplicas, externalizar o lock.
let tail = Promise.resolve();
export function withStoreLock(fn) {
  const task = tail.then(fn, fn);
  tail = task.catch(() => {});
  return task;
}
