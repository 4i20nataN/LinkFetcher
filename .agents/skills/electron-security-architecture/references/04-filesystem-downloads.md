# 04 — Filesystem & Download Security

Aplica-se a **todo** arquivo que entra no disco vindo da internet — mídia
baixada pelo usuário, não só o instalador de update (esse tem camada extra,
ver `05`).

## Diretórios seguros

- Downloads do usuário: diretório dedicado sob o diretório de dados do app
  (`app.getPath('userData')/downloads`), nunca direto em `Desktop`/`Downloads`
  do SO sem confirmação explícita do usuário.
- Temporários: `app.getPath('temp')` + subpasta exclusiva do app com nome
  imprevisível (evita colisão/plantio por outro processo), permissões
  restritas (0600/0700 no POSIX; ACL restrita no Windows).
- Nunca escrever fora desses diretórios sem passar por `resolveSafePath`
  (ver `03-input-validation.md`).

## Pipeline de verificação de todo download

1. **Content-Length** declarado vs limite máximo configurado — abortar
   antes de começar a gravar se exceder.
2. Gravar em arquivo temporário (`.part`), nunca no nome final direto —
   evita que um download interrompido pareça um arquivo válido.
3. Durante o stream, contar bytes reais recebidos e abortar se exceder o
   limite (proteção contra Content-Length mentiroso).
4. Ao terminar: calcular **SHA-256 e SHA-512** do arquivo temporário.
5. Verificar **magic number** (assinatura binária real dos primeiros bytes)
   contra o tipo esperado — nunca confiar só na extensão ou no
   `Content-Type` do servidor.
6. Verificar **extensão final** contra allowlist do domínio do app.
7. Sanitizar o nome final (ver `03`).
8. Mover (`rename`, atômico no mesmo filesystem) de `.part` para o nome
   final **só depois** de todas as checagens acima passarem.
9. Se qualquer etapa falhar: apagar o temporário, logar o evento, nunca
   deixar arquivo parcial/não verificado no diretório de downloads.

```ts
import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';

async function verifyDownloadedFile(tmpPath: string, opts: {
  maxBytes: number;
  expectedMagicNumbers: Buffer[];
  allowedExtensions: Set<string>;
  finalNameHint: string;
}): Promise<{ sha256: string; sha512: string; safeName: string }> {
  const stat = await fs.stat(tmpPath);
  if (stat.size > opts.maxBytes || stat.size === 0) {
    throw new SecurityError('download_size_invalid');
  }

  const header = Buffer.alloc(16);
  const fh = await fs.open(tmpPath, 'r');
  await fh.read(header, 0, 16, 0);
  await fh.close();
  if (!opts.expectedMagicNumbers.some((sig) => header.subarray(0, sig.length).equals(sig))) {
    throw new SecurityError('magic_number_mismatch');
  }

  const safeName = sanitizeFilename(opts.finalNameHint, opts.allowedExtensions);

  const sha256 = createHash('sha256');
  const sha512 = createHash('sha512');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(tmpPath);
    stream.on('data', (chunk) => { sha256.update(chunk); sha512.update(chunk); });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });

  return { sha256: sha256.digest('hex'), sha512: sha512.digest('hex'), safeName };
}
```

## Duplicatas e nomes de arquivo maliciosos

- Detecte duplicata por hash de conteúdo, não por nome — dois nomes
  diferentes com mesmo conteúdo não geram cópia redundante; mesmo nome com
  conteúdo diferente nunca sobrescreve silenciosamente (gerar sufixo).
- Extensões duplas / disfarçadas (`relatorio.pdf.exe`,
  `video.mp4\u200B.scr`) — rejeite após normalização Unicode se a extensão
  real (última, após normalizar) não estiver na allowlist.

## Symlink / Hardlink protection

- Ao escrever em um diretório controlado pelo app, verifique com `lstat`
  (não `stat`) se o destino já existe como symlink antes de abrir para
  escrita — nunca seguir um symlink plantado por conteúdo malicioso para
  fora do diretório permitido.
- Ao extrair arquivos compactados, rejeite entries do tipo symlink/hardlink
  por padrão, a menos que explicitamente necessário e com o mesmo
  `resolveSafePath` aplicado ao alvo do link.

## Timeout e retry de download

- Timeout de conexão e de inatividade (sem bytes por N segundos) separados
  do timeout total.
- Retry com backoff exponencial + jitter, número máximo de tentativas, e
  **nova verificação completa do zero** a cada tentativa (nunca "continuar"
  um hash parcial de tentativa anterior).

## Relatório de integridade

Cada download gera um registro auditável: URL de origem, hash sha256/sha512,
tamanho, timestamp, resultado de cada etapa de verificação — usado tanto
para debugging quanto para auditoria de segurança (ver `07-logging-audit.md`).
