# 07 — Security Logging & Audit

## O que logar (mínimo obrigatório)
- Autenticação/sessão (início, fim, falha)
- Mudança de permissão (concedida/negada pelos handlers de `01-window-hardening.md`)
- Violações de IPC (origem rejeitada, schema rejeitado, rate limit)
- Tentativas de navegação bloqueadas (`will-navigate` negado)
- Ataques bloqueados (path traversal, zip slip, hash mismatch, assinatura inválida)
- Eventos de update (check, verificação de assinatura, rollback bloqueado, instalação)
- Falhas de certificado TLS
- Detecção de tampering (hash de recurso crítico não bate)

## Formato
JSON lines, um evento por linha, schema fixo:
```json
{"ts":"2026-07-15T10:00:00.000Z","level":"security","event":"update.rollback_blocked","context":{"attempted":"2.1.0"},"sessionId":"…"}
```
- `event` de um enum fechado (não string livre) — facilita alerta/agregação.
- `sessionId`/`correlationId` por execução do app para rastrear uma cadeia de eventos.

## O que NUNCA logar
- Chave privada, chave de sessão, token de API, senha — nem parcial, nem hash reversível.
- Path completo de arquivos fora dos diretórios permitidos do app (pode vazar estrutura/usuário do SO).
- Payload IPC bruto quando pode conter dado sensível — logue metadados (canal, tamanho, resultado), não o conteúdo.

## Armazenamento e rotação
- Arquivo local em `userData/logs`, rotação por tamanho (ex.: 10 MB) e retenção (ex.: 30 dias), nunca crescimento ilimitado.
- Nível `security` sempre persistido, independente do nível de log geral configurado pelo usuário (não pode ser silenciado por uma opção de "modo silencioso").

## Integridade do log (opcional, reforço)
- Hash-chain: cada linha inclui hash da linha anterior — torna adulteração do log local detectável (não previne, mas evidencia).

## Envio remoto (se houver telemetria)
- Opt-in explícito, nunca automático por padrão.
- Nunca incluir PII além do estritamente necessário para diagnóstico; documentar no Privacy/Security README o que é coletado.
