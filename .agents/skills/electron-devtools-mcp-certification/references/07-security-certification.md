# 07 — Certificação de Segurança via DevTools

Esta seção **verifica em runtime** o que a skill `electron-security-architecture`
implementa em código — são complementares, não duplicadas. Se essa outra
skill estiver disponível, use-a para saber o que checar; use esta para
checar de fato, com o app rodando.

## Isolamento de contexto e Node integration

```js
// evaluate_script — deve retornar tudo `true`/`undefined` num renderer seguro
() => ({
  nodeRequireExposed: typeof window.require !== 'undefined',
  processExposed: typeof window.process !== 'undefined',
  bufferExposed: typeof window.Buffer !== 'undefined',
  contextIsolated: typeof window.api !== 'undefined' && typeof window.electron === 'undefined',
})
```
`nodeRequireExposed`/`processExposed`/`bufferExposed` sendo `true` é
falha crítica — indica `nodeIntegration` vazando para o mundo principal.

## Superfície do preload

```js
() => ({
  keys: Object.keys(window.api ?? {}),
  frozen: Object.isFrozen(window.api),
})
```
Confrontar a lista de `keys` contra o que a skill de segurança define
como API mínima esperada — qualquer chave a mais é superfície não
revisada. `frozen: false` é falha (permite poluição/override da API
exposta a partir de qualquer script rodando no renderer).

## CSP e Trusted Types

- `list_network_requests` → inspecionar header `content-security-policy`
  da resposta do documento principal via `get_network_request`.
- `list_console_messages` → violações de CSP aparecem como warnings/erros
  de console automaticamente quando uma diretiva bloqueia algo.
- `evaluate_script`: `() => !!window.trustedTypes` confirma que a API
  Trusted Types está disponível/habilitada se o CSP a exige.

## Navegação e janelas

- Tentar via `evaluate_script` abrir uma navegação para origem externa
  (`window.location.href = 'https://example.com'` ou
  `window.open('https://example.com')`) e observar (via `list_pages`)
  se uma nova página/navegação não autorizada de fato ocorre — se
  ocorrer, o `will-navigate`/`setWindowOpenHandler` da skill de
  segurança não está funcionando como projetado.

## Downloads e protocol handlers

- Disparar o fluxo de download do próprio app e usar
  `list_network_requests`/`get_network_request` para confirmar headers
  de resposta (`content-type`, `content-length`) batendo com o que o
  código de verificação espera antes de aceitar o arquivo.

## Lighthouse best-practices

`lighthouse_audit` (`mode: 'snapshot'` para estado atual, sem reload)
cobre uma fatia de boas práticas (uso de HTTPS, bibliotecas com
vulnerabilidade conhecida detectável, console errors) e acessibilidade —
tratar como complemento, não substituto do checklist dedicado de
segurança.

## O que esta camada NÃO certifica

Verificação do **update security** (assinatura Ed25519, hash SHA-512,
anti-rollback) não é observável via DevTools do renderer — é lógica do
processo main. Confirmar via teste de integração dedicado (ver skill de
segurança, `references/11-testing.md`), não via este playbook.
