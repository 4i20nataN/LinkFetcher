# Portable Auto-Update Implementation

## Resumo
Implementação de auto-atualização para builds **portable** (ZIP) + manutenção do fluxo NSIS para desktop instalado. Usuário comum clica "Atualizar" → app baixa, verifica, extrai por cima e reinicia — **zero intervenção técnica**.

---

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `electron/main.cjs` | Detecção portable via `PORTABLE_EXECUTABLE_DIR` ou `--portable`; desliga polling automático no portable; passa flag `isPortable` para handlers |
| `electron/updater/updateManager.cjs` | Nova função `downloadAndExtractPortable()`: baixa artifact `-portable.zip`, verifica SHA-512, extrai com `extract-zip` sobre pasta do app, atualiza anti-rollback |
| `electron/updater/handlers.cjs` | `update:apply` roteia para `downloadAndExtractPortable` se portable; `update:install` faz `app.relaunch()` no portable (já extraído) vs `shell.openPath()` NSIS no desktop |
| `package.json` | Adicionada dependência `extract-zip` |

---

## Fluxo Usuário Final (Portable)

1. Usuário clica "Verificar atualizações" → `update:check` retorna `{ updateAvailable, version, portable: true }`
2. Usuário clica "Baixar e instalar" → `update:apply` baixa ZIP portable, verifica assinatura Ed25519 + SHA-512, extrai **por cima da pasta atual** (overwrite)
3. `update:progress` emite `downloading` → `ready`
4. Usuário clica "Reiniciar agora" → `update:install` chama `app.relaunch()` + `app.exit(0)`
5. App reabre já na nova versão

---

## Requisitos de Release (GitHub Actions)

O workflow de release **deve** publicar 2 artifacts Windows:
- `LinkFetcher-Setup-x.y.z.exe` (NSIS) → `platform: "win32-x64"`
- `LinkFetcher-x.y.z-portable.zip` → `platform: "win32-x64"` + sufixo `-portable.zip` no `fileName`

Exemplo `manifest.json`:
```json
{
  "artifacts": [
    { "platform": "win32-x64", "fileName": "LinkFetcher-Setup-1.2.3.exe", "sha512": "...", "sizeBytes": 12345678 },
    { "platform": "win32-x64", "fileName": "LinkFetcher-1.2.3-portable.zip", "sha512": "...", "sizeBytes": 98765432 }
  ]
}
```

---

## Segurança (inalterada)
- Ed25519 signature no manifest (chave v1 em `verifyRelease.cjs`)
- SHA-512 de cada artifact verificado antes de extrair/executar
- Host pinning: `api.github.com`, `github.com`, `objects.githubusercontent.com`, `release-assets.githubusercontent.com`
- Anti-rollback via `localState.lastInstalledVersion`
- Sem "modo degradado" — qualquer falha aborta

---

## Próximos Passos (fora do escopo atual)
1. **Code signing** (Authenticode) no NSIS installer para remover SmartScreen warning
2. Rotação de chave Ed25519 (documentar procedimento)
3. Testar em CI: build portable → instalar → atualizar → verificar versão