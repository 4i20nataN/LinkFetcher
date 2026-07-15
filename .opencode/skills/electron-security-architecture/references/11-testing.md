# 11 — Security Testing

## Unit
- Cada validador de schema (IPC, manifest, deep link) testado com payload válido, inválido, e casos-limite (campo extra, campo faltando, tipo errado, valor no limite/fora do limite).
- `resolveSafePath`: testado com `../`, path absoluto, null byte, Unicode equivalente, symlink apontando para fora.

## Integration
- Handler de IPC invocado com `senderFrame` inesperado → deve rejeitar.
- Handler de IPC acima do rate limit → deve rejeitar a N+1 chamada.
- Download com `Content-Length` mentiroso (menor que o real) → deve abortar ao exceder no stream real.

## Segurança dirigida por classe de ataque
- **Path traversal**: array de payloads (`../../etc/passwd`, `..\\..\\Windows\\System32`, `%2e%2e%2f`, path absoluto) — todos rejeitados.
- **Zip Slip**: fixture de zip com entry `../evil.exe` — extração deve rejeitar antes de escrever.
- **Prototype pollution**: payload IPC com chave `__proto__`/`constructor.prototype` — deve ser ignorado/rejeitado, `Object.prototype` inalterado após o parse.
- **ReDoS**: input adversarial de tamanho crescente contra cada regex usada sobre dado externo — tempo de execução deve permanecer linear/limitado.

## Update system (crítico)
- Manifest com assinatura adulterada (1 byte alterado) → rejeitado.
- Manifest assinado corretamente mas `version` abaixo do piso local → rejeitado (rollback).
- Manifest com `repository` diferente do pinado → rejeitado, mesmo com assinatura válida (simula chave vazada + repo errado).
- Instalador cujo SHA-512 não bate com o manifest → rejeitado, staging limpo.
- Resposta da API do GitHub com host de asset fora da allowlist (redirect simulado) → rejeitado.

## Fuzz
- Property-based testing (`fast-check` ou equivalente) sobre todo validador de entrada — gerar strings/objetos aleatórios e garantir que o validador nunca lança exceção não tratada (deve sempre retornar rejeição estruturada) nem trava (timeout de teste).

## Regressão
- Todo bug de segurança corrigido vira um teste permanente referenciando o CWE/ticket correspondente — nunca fechar um bug de segurança sem teste de regressão.
