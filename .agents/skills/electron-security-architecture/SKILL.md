---
name: electron-security-architecture
description: Arquitetura de segurança defense-in-depth de nível enterprise para apps desktop Electron — hardening de BrowserWindow/session/preload, IPC com schema e rate limiting, validação de entrada, filesystem/download seguro, e um sistema de auto-atualização via GitHub Releases resistente a supply-chain attack (assinatura Ed25519, SHA-512, publisher pinning, anti-rollback, anti-replay), além de criptografia, secret management, logging/auditoria, anti-tampering, network security, CI/CD (CodeQL/Semgrep/SBOM/release signing) e checklist final mapeado a OWASP ASVS L3 / NIST SSDF / CWE / MITRE ATT&CK. USE ESTA SKILL sempre que o usuário mencionar Electron, app desktop multiplataforma, auto-update, GitHub Releases como canal de distribuição, download de mídia/arquivo de fontes externas, contextBridge/IPC, hardening de aplicação, supply-chain de release, ou pedir para tornar um app Electron "seguro", "profissional" ou "pronto para produção" — mesmo que a palavra "segurança" não apareça explicitamente.
---

# Electron Security Architecture

Skill de referência para projetar e implementar segurança defense-in-depth em apps
Electron que baixam conteúdo da internet, falam com serviços externos e se
auto-atualizam — cenário de maior risco real: **supply-chain compromise via
canal de atualização**, não o Electron em si.

## Princípios inegociáveis

1. **Zero Trust** — renderer, IPC, filesystem, rede e update server são todos
   não-confiáveis até prova em contrário.
2. **Fail Secure** — qualquer falha de verificação (hash, assinatura,
   schema, certificado) aborta a operação. Nunca há fallback "modo
   degradado sem verificação".
3. **Least Privilege** — renderer nunca tem Node; preload expõe o mínimo
   possível, com objetos congelados (`Object.freeze`).
4. **Defense in Depth** — cada camada assume que a anterior pode falhar.
   Hash de release + assinatura Ed25519 + verificação de Authenticode do
   instalador são checagens independentes, não substitutas uma da outra.
5. **Secure by Default** — toda opção nova do Electron entra desligada até
   ser avaliada; nunca copiar config de exemplo/tutorial sem revisar.

## Como navegar esta skill

| Se a tarefa é... | Leia |
|---|---|
| Configurar `BrowserWindow`, sessão, navegação, permissões, deep links | `references/01-window-hardening.md` |
| Preload / `contextBridge` / arquitetura de canais IPC | `references/02-preload-ipc.md` |
| Validar entrada (URLs, nomes de arquivo, JSON, paths) | `references/03-input-validation.md` |
| Baixar arquivos, verificar hash/assinatura/magic number, paths seguros | `references/04-filesystem-downloads.md` |
| **Auto-update via GitHub Releases** (prioridade máxima do projeto) | `references/05-update-security.md` |
| Criptografia, chaves, Windows Credential Manager | `references/06-crypto-secrets.md` |
| Logging de segurança e auditoria | `references/07-logging-audit.md` |
| Anti-tampering / anti-debug (opcional, não-invasivo) | `references/08-anti-tampering-debug.md` |
| TLS, redirects, DNS rebinding, HTTP client seguro | `references/09-network-security.md` |
| Dependências, GitHub Actions, CodeQL, SBOM, assinatura de release | `references/10-dependency-cicd.md` |
| Testes de segurança (unit/integration/fuzz) | `references/11-testing.md` |
| Auto-auditoria final e pontuação 0–100 | `checklists/security-audit-checklist.md` |

Templates de código prontos para adaptar estão em `assets/templates/` e os
workflows de CI/CD em `assets/workflows/`. Use-os como ponto de partida —
sempre revise nomes de pacote, repositório e chaves antes de usar em produção.

## Ordem de implementação recomendada

Para um app que já baixa conteúdo externo e se atualiza pelo GitHub, a ordem
por impacto de risco real (não por número de seção do documento original) é:

1. **Update security** (`05`) — é o canal com maior blast radius: um
   comprometimento aqui vira RCE em 100% da base instalada.
2. **Filesystem/download security** (`04`) — mesma lógica, aplicada a cada
   arquivo baixado pelo usuário, não só ao instalador.
3. **Preload/IPC** (`02`) e **window hardening** (`01`) — superfície de
   ataque a partir do conteúdo renderizado (páginas de terceiros, players
   embutidos etc.).
4. **Input validation** (`03`) — cola tudo isso, previne que um dado
   malformado vire path traversal, injection ou prototype pollution em
   qualquer camada acima.
5. Demais seções (cripto, logging, anti-tampering, network, CI/CD, testes)
   como reforço e institucionalização — não bloqueiam o MVP seguro, mas são
   obrigatórias antes de "produção com milhões de usuários".

## Regras absolutas (nunca violar)

- Nunca habilitar `nodeIntegration` no renderer, nunca desabilitar
  `contextIsolation` ou `sandbox`.
- Nunca instalar uma atualização sem assinatura Ed25519 válida **e** hash
  SHA-512 batendo **e** repositório/publisher pinado correspondendo.
- Nunca confiar em payload de IPC, em conteúdo baixado, em resposta de rede
  ou em nome/extensão de arquivo sem validação explícita.
- Nunca logar segredos, chaves privadas, tokens ou paths fora dos diretórios
  permitidos.
- Nunca reduzir uma verificação de segurança para "resolver rápido" — se uma
  checagem está barrando o fluxo feliz, o design do fluxo é que precisa
  mudar, não a checagem.

## Auto-auditoria

Depois de implementar qualquer seção, rode o checklist em
`checklists/security-audit-checklist.md`: ele mapeia cada item a OWASP ASVS
L3, CWE e NIST SSDF, e pede uma pontuação 0–100 justificada — só atribua
100 se cada vetor de ataque relevante ao app estiver de fato coberto por
código (não por documentação).
