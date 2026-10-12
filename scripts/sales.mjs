// Painel de vendas no terminal (leitura do D1, sem segredos novos).
// Uso: node scripts/sales.mjs [--limit 20]
// Exige login do wrangler (npx wrangler login). Sempre usa --config p/
// não cair no wrangler.jsonc fantasma da raiz.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workerDir = join(root, 'server', 'worker');
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 20);

function query(sql) {
  const out = execFileSync(
    'npx',
    ['-y', 'wrangler@latest', 'd1', 'execute', 'linkfetcher-licenses',
      '--remote', '--json', '--config', 'wrangler.toml', '--command', sql],
    { cwd: workerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const parsed = JSON.parse(out);
  return parsed?.[0]?.results ?? [];
}

const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const day = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const totals = query(`SELECT status, COUNT(*) AS n, ROUND(COALESCE(SUM(CASE WHEN status='paid' THEN price ELSE 0 END),0),2) AS revenue FROM checkouts GROUP BY status`);
const paid = totals.find((t) => t.status === 'paid');
console.log('\n== LinkFetcher PRO — vendas ==');
console.log(`Pagas: ${paid?.n ?? 0} (${brl(paid?.revenue)})`);
for (const t of totals.filter((x) => x.status !== 'paid')) {
  console.log(`  ${t.status}: ${t.n}`);
}

const rows = query(`SELECT email, price, paid_at, created_at FROM checkouts WHERE status='paid' ORDER BY paid_at DESC LIMIT ${limit}`);
console.log(`\n== Últimas ${rows.length} pagas ==`);
for (const r of rows) {
  console.log(`- ${day(r.paid_at)}  ${brl(r.price)}  ${r.email}`);
}
console.log('');
