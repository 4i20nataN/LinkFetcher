// Exporta a JWK privada p/ LICENSE_PRIVATE_JWK (stdout, linha única).
// Uso: node scripts/export-jwk.mjs  → cole a saída no .env do SERVIDOR.
// Nunca commitar a saída (é o segredo de emissão). Roda de qualquer cwd.
import { readFile } from 'node:fs/promises';

const url = new URL('../signing-keys/license.key', import.meta.url);
let file;
try {
  file = JSON.parse(await readFile(url, 'utf8'));
} catch {
  console.error('Sem signing-keys/license.key. Rode scripts/mint-key.mjs --init primeiro.');
  process.exit(1);
}
if (!file.privateJwk?.d) {
  console.error('license.key sem privateJwk.d — formato inesperado.');
  process.exit(1);
}
process.stdout.write(JSON.stringify(file.privateJwk));
