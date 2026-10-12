// Bump único de versão (package.json, tauri.conf, Cargo.toml/lock).
import { readFileSync, writeFileSync } from 'node:fs';

const next = process.argv[2];
if (!next || !/^\d+\.\d+\.\d+$/.test(next)) {
  console.error('Uso: npm run bump -- <x.y.z>   (ex.: npm run bump -- 1.4.2)');
  process.exit(1);
}

function patch(path, pattern, replacement) {
  const before = readFileSync(path, 'utf8');
  if (!pattern.test(before)) throw new Error(`${path}: padrão não encontrado`);
  writeFileSync(path, before.replace(pattern, replacement));
  console.log(`ok  ${path}`);
}

patch('package.json', /"version": "\d+\.\d+\.\d+"/, `"version": "${next}"`);
patch('src-tauri/tauri.conf.json', /"version": "\d+\.\d+\.\d+"/, `"version": "${next}"`);
patch('src-tauri/Cargo.toml', /^version = "\d+\.\d+\.\d+"$/m, `version = "${next}"`);
patch(
  'src-tauri/Cargo.lock',
  /name = "linkfetcher"\nversion = "\d+\.\d+\.\d+"/,
  `name = "linkfetcher"\nversion = "${next}"`,
);
console.log(`versão → ${next}`);
