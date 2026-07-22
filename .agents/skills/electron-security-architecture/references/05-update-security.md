# 05 — Auto-Update Security via GitHub Releases (prioridade máxima)

Este é o componente de maior risco real do app: um comprometimento aqui
resulta em execução de código arbitrário em 100% da base instalada, com a
própria distribuição do app como vetor. Trate GitHub Releases como um
**canal de transporte não confiável**, não como uma fonte de verdade — a
confiança vem exclusivamente da assinatura criptográfica, nunca do
transporte HTTPS ou da API do GitHub isoladamente.

## Modelo de ameaça

| Ameaça | Mitigação |
|---|---|
| GitHub / conta do mantenedor comprometidos, release maliciosa publicada | Assinatura Ed25519 do manifest com chave privada mantida **fora** do repositório (secret de CI), verificada contra chave pública fixada no binário do app |
| MITM / DNS hijack durante o download | TLS + pinning de host (`api.github.com`, host de assets), rejeição de redirect para host fora da allowlist |
| Release antiga e válida servida de volta (rollback attack) | Ratchet de versão monotônica persistido localmente — nunca aceitar versão abaixo do "piso" já visto, mesmo com assinatura válida |
| Reprodução de uma resposta de API antiga (replay) | Verificação de `published_at`/nonce do manifest contra janela de tempo + piso de versão |
| Download interrompido/parcial tratado como válido | Verificação de tamanho + hash **só após** download completo, arquivo fica em `.part` até então |
| Manifest ou instalador modificado em trânsito | SHA-512 do instalador conferido contra o manifest assinado; manifest em si é o que carrega assinatura, não os assets soltos |
| Chave privada de assinatura vazada | Chave só existe em secret do CI (idealmente KMS/HSM em escala "milhões de usuários"), rotação suportada via lista de chaves públicas confiáveis versionada no app (ver "Rotação de chave") |
| Repositório errado / typosquatting de fork | Owner/repo pinados como constante no binário, nunca lidos de config editável pelo usuário |

## Arquitetura

```
[CI/CD — GitHub Actions]                    [App instalado — processo main]
  1. build dos artefatos                       5. GET /repos/{owner}/{repo}/releases/latest
  2. sha256+sha512 de cada artefato               (host pinado, TLS, timeout, sem seguir
  3. gera manifest.json                           redirect fora da allowlist)
  4. assina manifest.json com Ed25519           6. valida schema da resposta
     (chave privada só em secret do CI)         7. baixa manifest.json + manifest.json.sig
  5. publica na Release:                        8. verifica assinatura Ed25519 do manifest
     - instalador(es)                              contra chave pública fixada no app
     - manifest.json                               → falha = aborta, loga, para aqui
     - manifest.json.sig                        9. verifica version > piso local persistido
     - CHECKSUMS.txt                               (anti-rollback) e dentro de janela de tempo
                                                10. baixa o instalador referenciado no manifest
                                                11. verifica SHA-512 do instalador == manifest
                                                12. (Windows) verifica assinatura Authenticode
                                                    do instalador contra thumbprint esperado
                                                13. só então move para staging e executa
                                                14. atualiza o piso de versão local
```

Cada estágio (9–13) é uma checagem independente. Nenhuma serve de
substituta para outra — mesmo que a chave Ed25519 fosse comprometida, o
Authenticode do instalador é uma segunda cadeia de confiança (certificado de
publisher, gerenciado separadamente, tipicamente por um provedor de
assinatura de código).

## Manifest assinado

```jsonc
// manifest.json — schema
{
  "schemaVersion": 1,
  "repository": "seu-usuario/linkfatcher",   // pinado, comparado exatamente
  "version": "2.4.0",                         // semver estrito
  "minimumSupportedVersion": "2.0.0",         // piso absoluto de compatibilidade
  "publishedAt": "2026-07-10T12:00:00Z",
  "artifacts": [
    {
      "platform": "win32-x64",
      "fileName": "LinkFatcher-Setup-2.4.0.exe",
      "sha256": "…",
      "sha512": "…",
      "sizeBytes": 84213760,
      "authenticodeThumbprint": "…"           // opcional, reforça verificação Windows
    }
  ]
}
```

O `manifest.json.sig` é a assinatura Ed25519 **detached**, em base64, do
conteúdo bruto (bytes exatos) do `manifest.json` publicado — nunca assine um
objeto re-serializado no cliente, sempre os bytes originais do arquivo
baixado.

## Por que Ed25519 via `node:crypto` nativo

O verificador de update roda antes/independente de qualquer outra lógica do
app e é o componente mais sensível do sistema — sua própria cadeia de
dependências é parte da superfície de ataque de supply-chain. `node:crypto`
suporta geração, assinatura e verificação Ed25519 nativamente desde o Node
12 (`generateKeyPairSync('ed25519')`, `sign`/`verify` com `algorithm: null`)
sem exigir nenhum pacote npm adicional no runtime do verificador. Uma lib
externa aqui adicionaria justamente o tipo de dependência transitiva que
este módulo existe para não confiar cegamente.

Ver implementação completa em `assets/templates/main/updater/verifyRelease.ts`.

## Ratchet anti-rollback

Persistir localmente (arquivo em `userData`, não editável pelo usuário sem
privilégio elevado, idealmente com um HMAC próprio usando uma chave derivada
por máquina para detectar adulteração) a maior versão já **instalada com
sucesso**. Nenhuma atualização é aceita abaixo desse piso, mesmo com
assinatura Ed25519 válida — isso neutraliza o cenário em que um atacante com
acesso de escrita ao canal serve de volta uma release antiga que era válida
(assinada) no passado mas hoje é vulnerável.

```ts
if (semverLt(manifest.version, localState.lastInstalledVersion)) {
  logSecurityEvent('update.rollback_blocked', { attempted: manifest.version });
  throw new SecurityError('rollback_rejected');
}
```

## Pinning de host e repositório

```ts
const PINNED_OWNER_REPO = 'seu-usuario/linkfatcher'; // constante em código, nunca config
const PINNED_API_HOST = 'api.github.com';
const PINNED_ASSET_HOSTS = new Set(['github.com', 'objects.githubusercontent.com']);
```

Toda resposta da API GitHub deve ter `full_name` batendo exatamente
`PINNED_OWNER_REPO` — protege contra o cenário onde a config de update
aponta (por bug ou tampering) para um fork/typosquat. Redirects de download
só são seguidos se o host de destino está em `PINNED_ASSET_HOSTS`.

## Downgrade / manutenção de versões antigas

Se o app precisa permitir downgrade explícito (feature, não ataque), isso é
uma ação **do usuário**, autenticada por confirmação explícita na UI, nunca
automática — e ainda assim nunca abaixo de `minimumSupportedVersion` do
manifest mais recente conhecido (uma versão pode ter sido descontinuada por
motivo de segurança).

## Rotação de chave de assinatura

Fixar mais de uma chave pública confiável no app (atual + próxima), cada
manifest declarando `signingKeyId`. Rotação: publicar releases assinadas
pela chave nova por um período de sobreposição, remover a chave antiga do
app só em uma versão subsequente já atualizada via a nova chave — nunca
remover a única chave que valida a versão atualmente instalada de um
usuário sem uma ponte.

## Instalação

- Baixe para staging isolado (`.part` → renomeio atômico só após todas as
  verificações).
- Nunca execute o instalador com privilégios elevados a partir de um path
  gravável por outros usuários do sistema.
- Em Windows, prefira lançar o instalador nativo (que já verifica seu
  próprio Authenticode) em vez de aplicar patch binário in-process.
- Limpe o staging em qualquer falha — nunca deixe um instalador
  parcialmente verificado marcado como "pronto para instalar".

## Checklist específico (resumo executável)

- [ ] Chave privada de assinatura nunca commitada, só em secret do CI
- [ ] Chave pública fixada como constante no código-fonte, revisada em PR
- [ ] Owner/repo pinados como constante, não configuráveis em runtime
- [ ] Verificação de assinatura do manifest antes de ler qualquer campo dele
- [ ] SHA-512 do instalador conferido byte a byte contra o manifest
- [ ] Ratchet de versão anti-rollback persistido e verificado
- [ ] Redirects de download restritos à allowlist de hosts
- [ ] Download para `.part`, rename atômico só após todas as checagens
- [ ] Falha em qualquer etapa aborta e loga — nunca modo degradado
- [ ] (Windows) Authenticode do instalador verificado como checagem
      independente do hash do manifest

Ver também `assets/workflows/release.yml` (pipeline de build/assinatura) e
`assets/templates/main/updater/` (código completo do verificador).
