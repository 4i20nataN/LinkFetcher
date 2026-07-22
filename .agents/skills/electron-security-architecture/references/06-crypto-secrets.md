# 06 — Cryptography & Secret Management

## Regras gerais
- Sem segredo em código-fonte, `.env` versionado ou config editável pelo usuário.
- Só algoritmos modernos: AES-256-GCM, Ed25519, ECDSA (P-256+), SHA-256/512, Argon2id, PBKDF2 (só se Argon2id indisponível na plataforma).
- Toda geração de aleatoriedade via `crypto.randomBytes`/`crypto.randomUUID` — nunca `Math.random()` para nada com implicação de segurança.

## Dados em repouso (config local, tokens de sessão, cache sensível)
```ts
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

function encryptAtRest(plaintext: Buffer, key: Buffer): { iv: Buffer; ciphertext: Buffer; tag: Buffer } {
  const iv = randomBytes(12); // GCM: 12 bytes, nunca reutilizar (iv, key) juntos
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, ciphertext, tag: cipher.getAuthTag() };
}
```
- Nonce/IV de 12 bytes gerado por chamada, nunca derivado de contador previsível cruzando processos.
- `tag` (GCM auth tag) sempre verificado na descriptografia — falha de auth = fail secure, nunca ignorar.

## Chave mestra: Windows Credential Manager
- Preferir a API nativa do SO para guardar a chave mestra (que por sua vez cifra o resto), não a chave direto no disco.
- Windows: DPAPI (`CryptProtectData`/`CryptUnprotectData`) — acessível via addon nativo pequeno e auditável, ou builds do `electron` que expõem `safeStorage` (API oficial do Electron, usa DPAPI no Windows e Keychain no macOS) — prefira `safeStorage` do próprio Electron a uma dependência npm de terceiros para isso.
```ts
import { safeStorage } from 'electron';
if (safeStorage.isEncryptionAvailable()) {
  const enc = safeStorage.encryptString(secret);
  // persistir `enc` (Buffer) — nunca o `secret` em texto puro
}
```

## Derivação de chave a partir de senha (se aplicável)
- Argon2id (via lib nativa bem mantida) com parâmetros mínimos: memória ≥ 64 MB, iterações ≥ 3, paralelismo ajustado ao hardware alvo.
- PBKDF2-SHA512 como fallback, ≥ 600.000 iterações (patamar 2025+, revisar periodicamente contra recomendação atual do OWASP).

## Assinatura (ver 05 para uso aplicado a update)
- Ed25519 via `node:crypto` nativo para assinatura de manifest/release — sem dependência externa.
- ECDSA P-256 como alternativa se o ecossistema de assinatura exigir (ex.: Authenticode do Windows já usa sua própria PKI — não reinvente, use `signtool`).

## Wiping de memória
- Strings JS são imutáveis e não há wipe garantido — para segredos de vida curta, use `Buffer` e `buffer.fill(0)` explicitamente após o uso, mesmo sabendo que o GC pode ter cópias residuais (mitigação parcial, não garantia).
- Minimize o tempo de vida do segredo em memória: decrypt → usar → wipe, nunca manter decriptado em estado global/cache maior que o necessário.

## Expiração e rotação
- Todo token de sessão/API tem TTL curto e é revalidado, nunca "válido para sempre".
- Chaves de assinatura de release seguem processo de rotação com sobreposição (ver `05-update-security.md#rotação-de-chave-de-assinatura`).
