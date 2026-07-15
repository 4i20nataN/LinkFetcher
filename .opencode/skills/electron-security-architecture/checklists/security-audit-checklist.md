# Checklist de Auditoria Final

Preencher após implementar cada seção. Só atribuir "OK" quando houver
**código** implementando o controle — documentação/intenção não conta.

| # | Controle | Ref. skill | OWASP ASVS L3 | CWE | NIST SSDF | Status | Risco se ausente |
|---|---|---|---|---|---|---|---|
| 1 | contextIsolation+sandbox+nodeIntegration:false | 01 | V14 | CWE-829 | PW.4 | | Crítico |
| 2 | Navigation/window-open guard | 01 | V14.5 | CWE-601 | PW.4 | | Alto |
| 3 | Permission handlers fail-secure | 01 | V4 | CWE-862 | PW.4 | | Médio |
| 4 | contextBridge com API mínima e congelada | 02 | V14.5 | CWE-1188 | PW.5 | | Crítico |
| 5 | IPC: schema+origem+rate limit+timeout | 02 | V5 | CWE-20 | PW.5 | | Alto |
| 6 | Path traversal / Zip Slip bloqueados | 03,04 | V12.3 | CWE-22 | PW.5 | | Crítico |
| 7 | Command injection eliminado por design (execFile/args) | 03 | V5.3 | CWE-78 | PW.5 | | Crítico |
| 8 | Prototype pollution mitigado | 03 | V5.1 | CWE-1321 | PW.5 | | Alto |
| 9 | Download: hash+magic number+extensão antes de mover para final | 04 | V12 | CWE-434 | PW.5 | | Crítico |
| 10 | Update: assinatura Ed25519 do manifest verificada | 05 | V10 | CWE-494 | PW.5, PS.2 | | Crítico |
| 11 | Update: SHA-512 do instalador conferido | 05 | V10 | CWE-353 | PW.5 | | Crítico |
| 12 | Update: anti-rollback (ratchet de versão) | 05 | V10 | CWE-696 | PW.5 | | Crítico |
| 13 | Update: repo/host pinados | 05 | V10 | CWE-346 | PW.5 | | Crítico |
| 14 | Secrets: nunca em código, `safeStorage`/DPAPI usado | 06 | V6 | CWE-798 | PS.1 | | Alto |
| 15 | Criptografia: só algoritmos modernos, nonce nunca reutilizado | 06 | V6 | CWE-330 | PW.5 | | Alto |
| 16 | Logging de segurança sem vazamento de segredo | 07 | V7 | CWE-532 | RV.1 | | Médio |
| 17 | Electron Fuses configuradas (asar integrity, no RunAsNode) | 08 | V14 | CWE-494 | PW.4 | | Alto |
| 18 | TLS estrito, sem bypass de certificado | 09 | V9 | CWE-295 | PW.5 | | Crítico |
| 19 | SSRF/DNS rebinding mitigado no cliente HTTP | 09 | V12.6 | CWE-918 | PW.5 | | Alto |
| 20 | CI: CodeQL+Semgrep+audit+secret scanning ativos | 10 | V14 | CWE-1104 | PW.8 | | Médio |
| 21 | Release assinada por pipeline com permissões mínimas | 10 | V10 | CWE-494 | PS.2 | | Crítico |
| 22 | Suite de testes de segurança cobrindo cada classe de ataque | 11 | — | — | PW.7 | | Médio |

## Pontuação (0–100)

- Cada item "Crítico" ausente: -15 pontos (limite mínimo 0).
- Cada item "Alto" ausente: -8 pontos.
- Cada item "Médio" ausente: -4 pontos.
- 100 só é válido se todo item Crítico e Alto relevante ao app estiver
  implementado e coberto por teste de regressão (seção 11).

## Fraquezas conhecidas / melhorias futuras

Listar aqui, por item do app real (não genérico), o que ainda não foi
implementado e o risco residual aceito — isso é parte obrigatória da
auditoria, não um anexo opcional.
