# 08 — Anti-Tampering & Anti-Debug (não-invasivo)

## Electron Fuses (mecanismo oficial, preferir a qualquer solução caseira)
Configurar em build (`@electron/fuses`):
- `RunAsNode: false` — impede executar o binário como runtime Node genérico.
- `EnableCookieEncryption: true`.
- `OnlyLoadAppFromAsar: true` — impede carregar código de fora do `.asar` empacotado.
- `EnableNodeCliInspectArguments: false` — bloqueia `--inspect` no binário empacotado (evita anexar debugger remoto em produção).
- `EnableEmbeddedAsarIntegrityValidation: true` (Electron 21+) — valida hash do `.asar` em runtime contra o hash embutido no binário no momento do build.

## Integridade de recursos críticos
- No build, gerar hash (SHA-256) de cada arquivo crítico do bundle do renderer e embutir em um manifest assinado (mesmo mecanismo de `05`, ou um manifest interno separado).
- No startup do main, antes de carregar a janela, recalcular hash dos arquivos e comparar — divergência loga evento de tampering e, dependendo da política, recusa iniciar ou entra em modo restrito.

## DLL/módulo inesperado (Windows, avançado)
- Enumerar módulos carregados no processo (via API nativa) e comparar contra allowlist conhecida do próprio Electron/Chromium/dependências — flag de módulos fora da lista. Tratar como sinal para log/telemetria, não como bloqueio automático (falsos positivos de AV/overlay são comuns).

## Anti-debug — apenas detecção, nunca crash de usuário legítimo
```ts
app.on('web-contents-created', (_e, contents) => {
  contents.on('devtools-opened', () => {
    logSecurityEvent('devtools.opened', { url: contents.getURL() });
    // apenas log — nunca contents.closeDevTools() de forma agressiva
    // em builds de produção sem devtools habilitado (ver 01), isso não deveria nem ser alcançável
  });
});
```
- Detecção de timing (delta entre `Date.now()` esperado e real em um loop) pode indicar debugger anexado — usar só como sinal de telemetria, nunca para negar funcionalidade a um usuário legítimo (falsos positivos em máquinas lentas/virtualizadas são reais).
- Nunca implementar anti-debug que degrade a experiência de quem só tem DevTools aberto por curiosidade — o objetivo é visibilidade, não hostilidade ao usuário.

## Configuração como superfície de tampering
- Arquivos de config local sensíveis (ex.: piso de versão do updater) protegidos por HMAC com chave derivada por instalação (ver `06`), não só por permissão de arquivo do SO.
