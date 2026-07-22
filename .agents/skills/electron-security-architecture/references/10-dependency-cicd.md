# 10 — Dependency & CI/CD Security

## Auditoria de dependências
- `npm audit --omit=dev` no CI, falha o build em severidade alta/crítica.
- Revisar dependências transitivas de qualquer módulo que toque IPC, updater ou parsing de dado externo — preferir zero-dependência nesses módulos quando viável (ver `05` sobre `node:crypto` nativo).
- SBOM (CycloneDX) gerado a cada release (`@cyclonedx/cyclonedx-npm`) e publicado como asset da release — rastreabilidade de supply chain para auditoria externa.

## GitHub Actions — `security.yml`
Ver `assets/workflows/security.yml`. Componentes:
- **CodeQL** (`github/codeql-action`) — SAST nativo do GitHub, roda em push/PR e agendado.
- **Semgrep** (regras OWASP + regras customizadas para os padrões desta skill: `nodeIntegration: true`, `contextIsolation: false`, `shell: true` em `spawn`, `rejectUnauthorized: false`).
- **ESLint com plugin de segurança** (`eslint-plugin-security`, `eslint-plugin-no-unsanitized`).
- **Dependency review** (`actions/dependency-review-action`) em PRs — bloqueia introdução de dependência com vulnerabilidade conhecida ou licença incompatível.
- **Secret scanning** (GitHub Secret Scanning nativo + `gitleaks-action` como segunda camada).
- **License check** — falha se dependência nova tiver licença fora da allowlist do projeto.

## Permissões mínimas de workflow
```yaml
permissions:
  contents: read
```
Elevar (`contents: write`, `id-token: write`) só no job específico que precisa publicar a release, nunca no workflow inteiro.

## Pinning de actions
- Referenciar actions de terceiros por **SHA commit**, não por tag (`uses: owner/action@<sha>` em vez de `@v4`) — tags podem ser movidas pelo mantenedor da action ou por um atacante que comprometa a conta.

## Assinatura de release (liga com `05`)
- Job dedicado `sign-release`, roda só após todos os jobs de build+teste+scan passarem, com a chave privada Ed25519 injetada via secret do repositório (nunca em log, `::add-mask::` no workflow).
- Considerar KMS/HSM (ex.: AWS KMS, Azure Key Vault) para assinatura em escala "milhões de usuários" em vez de secret bruto do GitHub Actions.

## Geração de checksum e manifest
Ver `assets/workflows/release.yml` — job gera `manifest.json`, hashes SHA-256/512 de cada artefato, assina, e publica `CHECKSUMS.txt` legível por humano junto dos binários.
