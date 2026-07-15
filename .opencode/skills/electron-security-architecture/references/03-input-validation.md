# 03 — Input Validation

Todo dado que entra no processo main (IPC, download, deep link, arquivo lido
do disco, resposta de rede) é hostil até validado. Regra prática: **allowlist
sempre, denylist nunca** — mais fácil de auditar e não vaza com casos não
previstos.

## XSS (refletido, armazenado, DOM-based)

- `contextIsolation` + `sandbox` (ver `01`) já eliminam a maior classe de
  XSS→RCE do Electron.
- Nunca usar `dangerouslySetInnerHTML`/`innerHTML` com dado externo. Se
  precisar renderizar HTML de terceiro (ex.: descrição de mídia baixada),
  sanitize com uma allowlist estrita de tags (`DOMPurify` configurado sem
  `SCRIPT`, `STYLE`, atributos `on*`, `javascript:` em `href`/`src`).
- CSP estrita (ver `13`/`09`) como segunda camada, não a única.

## Prototype Pollution

- Nunca `JSON.parse` seguido de merge recursivo genérico sem checar chaves
  `__proto__`, `constructor`, `prototype`.
- Prefira `Object.create(null)` para mapas de dados externos, ou uma lib de
  parse que já bloqueia isso.
- `Object.freeze(Object.prototype)` no processo main como última rede de
  segurança (não substitui validação).

## Command / Shell / Argument Injection

- **Nunca** `child_process.exec` com string interpolada. Use
  `execFile`/`spawn` com array de argumentos — elimina injection por
  design, não por escaping.
- Se um argumento vem de fora (ex.: URL a passar para uma ferramenta de
  download), valide contra um schema estrito (regex de URL, não "contém
  http") antes de colocar no array de args.
- Nunca `shell: true` em `spawn`/`execFile` com qualquer dado externo no
  comando ou args.

## Regex DoS (ReDoS)

- Evite regex com grupos aninhados quantificados (`(a+)+`, `(.*)+`) sobre
  entrada de tamanho não limitado.
- Prefira parsers dedicados (URL → `new URL()`, não regex) sempre que
  possível.
- Para regex inevitável sobre entrada externa, limite o tamanho da entrada
  antes de testar e considere um motor com timeout (`re2`-like) para casos
  críticos.

## Directory / Path Traversal & Zip Slip

```ts
import path from 'node:path';

function resolveSafePath(baseDir: string, userSuppliedName: string): string {
  const resolvedBase = path.resolve(baseDir);
  const candidate = path.resolve(resolvedBase, userSuppliedName);
  if (!candidate.startsWith(resolvedBase + path.sep)) {
    throw new SecurityError('path_traversal_blocked');
  }
  return candidate;
}
```

- Aplique isso a **todo** nome de arquivo derivado de fonte externa: nome de
  download, entrada de zip, path de deep link, nome sugerido por resposta de
  rede.
- Zip Slip: ao extrair um arquivo compactado, valide cada entry com
  `resolveSafePath` **antes** de escrever — nunca confie no path interno do
  zip. Rejeite entries com `..`, paths absolutos, ou links simbólicos
  apontando fora do destino.
- Normalize Unicode (`.normalize('NFC')`) antes de comparar/validar nomes —
  previne bypass via formas Unicode equivalentes visualmente diferentes.
- Rejeite null byte (`\0`) em qualquer string usada como path — trunca
  strings no SO em alguns runtimes, clássico bypass de extensão.

## Malformed URLs

- Sempre `new URL(input)` dentro de `try/catch` — nunca regex de validação
  de URL "boa o bastante".
- Rejeite protocolo fora da allowlist (`https:` só, salvo caso justificado).
- Rejeite `url.username`/`url.password` preenchidos (vetor de phishing:
  `https://trusted.com@evil.com/`).
- Compare host contra allowlist exata (`url.hostname === 'api.github.com'`),
  nunca `includes('github.com')` (bypass trivial com
  `github.com.evil.com`).

## Dangerous filenames / invalid MIME / extensão

- Allowlist de extensões esperadas para o domínio do app (ex.: apenas
  extensões de mídia suportadas) — nunca denylist de extensões perigosas.
- MIME declarado pelo servidor é **hint**, não verdade — sempre confirme com
  magic number (ver `04-filesystem-downloads.md`).
- Sanitize nome de arquivo final: remova separadores de path, caracteres de
  controle, nomes reservados do Windows (`CON`, `PRN`, `AUX`, `NUL`,
  `COM1`-`9`, `LPT1`-`9`), e trunque para um tamanho seguro preservando a
  extensão.

## Oversized payloads / encodings inesperados

- Limite de tamanho **antes** de parsear (Content-Length checado antes do
  body, limite hard mesmo se o header mentir — pare de ler o stream ao
  atingir o limite).
- Force um encoding conhecido (`utf-8`) e rejeite payloads que falhem a
  decodificação estrita, em vez de tentar adivinhar/reparar.

## JSON / YAML / XML malformados

- JSON: `JSON.parse` já falha em malformado — trate a exceção como rejeição,
  não tente "consertar" o texto.
- YAML: se inevitável, use um parser em modo **safe** (sem execução de
  tags customizadas/`!!python/object` equivalentes) — nunca `yaml.load`
  inseguro.
- XML: desabilite DTD externo e resolução de entidade (previne XXE) — se o
  app não precisa de XML de fontes externas, não adicione o parser.

## Validação na fronteira, não só no core

Todo ponto de entrada (IPC handler, download handler, deep-link handler, leitura
de arquivo de config) deve chamar o schema de validação correspondente
**antes** de qualquer lógica de negócio rodar — nunca validar "no meio do
caminho" depois que o dado já foi usado para alguma decisão.
