# Windows Code Signing (Authenticode) — Remover SmartScreen

## Objetivo
Aplicar **assinatura Authenticode** no instalador NSIS (`.exe`) e no ZIP portátil (`.zip`) para eliminar o aviso do Windows SmartScreen **"O Windows protegeu o seu PC"**.

---

## 1. Preparação do Certificado

| Tipo | Descrição | Recomendação |
|------|-----------|--------------|
| **EV (Extended Validation)** | Confiança imediata no SmartScreen, token de hardware obrigatório | ✅ Produção |
| **OV (Organization Validation)** | Confiança acumulada em dias/semanas, arquivo de software | Desenvolvimento/Teste |

### Emissoras recomendadas
- DigiCert (EV Code Signing)
- Sectigo (antiga Comodo)
- GlobalSign
- SSL.com

### Arquivos recebidos
- `certificate.pfx` (PKCS#12, contém chave privada)
- Senha do PFX

---

## 2. Teste Local (máquina Windows)

### A. Instalar PFX no repositório de certificados do Windows
```powershell
# PowerShell como Administrador
$pfx = "C:\caminho\certificate.pfx"
$pwd = "sua-senha"
Import-PfxCertificate -FilePath $pfx -CertStoreLocation Cert:\LocalMachine\My -Password (ConvertTo-SecureString $pwd -AsPlainText -Force)
```

### B. Obter Thumbprint (impressão digital)
```powershell
Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*LinkFetcher*" } | Select-Object Thumbprint, Subject, NotAfter
```
→ Copie o **Thumbprint** (sem espaços) para a variável `CSC_SHA256`.

### C. Testar assinatura local
```powershell
# signtool (requer Windows SDK)
$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"

& $signtool sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 /sha1 <THUMBPRINT> /v "release\LinkFetcher-Setup-1.0.2-x64.exe"
```

### D. Verificar assinatura
```powershell
& $signtool verify /pa /v "release\LinkFetcher-Setup-1.0.2-x64.exe"
# Deve mostrar: "Successfully verified: ..."
```

---

## 3. Configuração no CI/CD (GitHub Actions)

### Secrets necessários (Settings → Secrets → Actions)

| Secret | Valor |
|--------|-------|
| `CSC_LINK` | PFX codificado em **Base64** (`certutil -encode certificate.pfx cert.b64 && cat cert.b64`) |
| `CSC_KEY_PASSWORD` | Senha do PFX |
| `CSC_SHA256` | Thumbprint SHA-256 (opcional se usar PFX via `CSC_LINK`) |

### Codificar PFX em Base64 (uma vez só, local)
```powershell
certutil -encode certificate.pfx cert.b64
Get-Content cert.b64 | Set-Clipboard
# Cole no secret CSC_LINK
```

### Workflow (trecho relevante)
```yaml
# .github/workflows/release.yml
jobs:
  build-and-sign:
    runs-on: windows-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - name: Build & Sign (electron-builder)
        run: npm run package:win
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          CSC_SHA256: ${{ secrets.CSC_SHA256 }}
      - name: Sign manifest.json (Ed25519)
        run: node scripts/sign-manifest.cjs --manifest release/manifest.json --private-key "${{ secrets.UPDATE_SIGNING_PRIVATE_KEY }}" --output release/manifest.json.sig
      - name: Upload Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            release/LinkFetcher-Setup-*.exe
            release/LinkFetcher-Portable-*.zip
            release/manifest.json
            release/manifest.json.sig
            release/CHECKSUMS_SHA512.txt
```

---

## 4. Configuração no `package.json` (electron-builder)

```json
"build": {
  "win": {
    "target": [
      { "target": "nsis", "arch": ["x64"] },
      { "target": "portable", "arch": ["x64"] }
    ],
    "certificateFile": "${env:CSC_LINK}",
    "certificatePassword": "${env:CSC_KEY_PASSWORD}",
    "certificateSha256": "${env:CSC_SHA256}",
    "signingAlgorithm": "sha256",
    "timestamp": "http://timestamp.digicert.com",
    "publisherName": "Natan Vanim",
    "verifyUpdateCodeSignature": true
  }
}
```

| Campo | Função |
|-------|--------|
| `certificateFile` | PFX (base64) ou caminho |
| `certificatePassword` | Senha do PFX |
| `certificateSha256` | Thumbprint se usar certificado no Windows Store |
| `timestamp` | RFC 3161 timestamp (obrigatório para validade pós-expiração do cert) |
| `verifyUpdateCodeSignature` | Electron verifica assinatura ao auto-atualizar |

---

## 5. Scripts Auxiliares

### `scripts/sign-windows.cjs` — Assinatura pós-build (fallback/manual)
```bash
npm run sign:win
```
Assina todos `.exe` e `.zip` em `release/` usando `signtool` (Windows SDK) ou PFX.

### `scripts/sign-manifest.cjs` — Assinatura Ed25519 do manifest
```bash
node scripts/sign-manifest.cjs --manifest release/manifest.json --private-key "$PRIVATE_KEY" --output release/manifest.json.sig
```
Usado no workflow para gerar `manifest.json.sig` verificado pelo `verifyRelease.cjs`.

---

## 6. Checklist de Release

- [ ] Certificado EV/OV válido e não expirado
- [ ] Secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `CSC_SHA256` configurados no GitHub
- [ ] `npm run package:win` gera instalador + portátil assinados
- [ ] `signtool verify` passa nos artefatos
- [ ] `manifest.json` inclui **todos** artefatos (NSIS, Portable, APK) com `sha512` e `sizeBytes`
- [ ] `manifest.json.sig` gerado com chave privada Ed25519 atual
- [ ] `CHECKSUMS_SHA512.txt` confere com artifacts upado
- [ ] GitHub Release contém: `.exe`, `.zip`, `.apk`, `manifest.json`, `manifest.json.sig`, `CHECKSUMS_SHA512.txt`

---

## 7. Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| "SignTool Error: No certificates found" | Thumbprint errado / cert não no store | Verifique `CSC_SHA256` ou use PFX via `CSC_LINK` |
| "Timestamp server unavailable" | Rede / firewall | Use `http://timestamp.digicert.com` ou `http://timestamp.sectigo.com` |
| SmartScreen ainda avisa | Certificado OV novo (reputação zero) | Aguarde dias/semanas ou use EV |
| `verifyUpdateCodeSignature` falha | Assinatura inválida / corrompida | Re-assine, confira `signtool verify` |

---

## 8. Referências
- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Microsoft Authenticode](https://learn.microsoft.com/windows/win32/seccrypto/authenticode)
- [SmartScreen Reputation](https://learn.microsoft.com/windows/security/application-security/smartscreen)