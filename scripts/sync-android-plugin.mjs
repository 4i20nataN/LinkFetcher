// Fonte canônica do plugin Android: `src-tauri/android-plugin/*.kt`.
// Copia para `gen/.../app/` (o `android init` do Tauri apaga customização
// manual de lá — edite o canônico, nunca o `gen/`).
// Uso: `npm run android:sync` (aplica) / `--check` (CI: falha se o gen/
// estiver dessincronizado).
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src-tauri', 'android-plugin');
const dst = join(root, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'java', 'com', 'linkfetcher', 'app');
const check = process.argv.includes('--check');

const files = readdirSync(src).filter((f) => f.endsWith('.kt')).sort();
let dirty = 0;
for (const f of files) {
  const from = join(src, f);
  const to = join(dst, f);
  const want = readFileSync(from, 'utf8');
  const have = existsSync(to) ? readFileSync(to, 'utf8') : null;
  if (have === want) {
    console.log(`ok  ${f}`);
    continue;
  }
  dirty++;
  if (check) {
    console.log(`STALE  ${f}`);
  } else {
    mkdirSync(dst, { recursive: true });
    copyFileSync(from, to);
    console.log(`sync  ${f}`);
  }
}
if (dirty > 0) {
  console.error(check
    ? `${dirty} arquivo(s) dessincronizados — rode 'npm run android:sync' e commite o gen/.`
    : `${dirty} arquivo(s) sincronizados.`);
  process.exit(check ? 1 : 0);
}
console.log('plugin android sincronizado.');
