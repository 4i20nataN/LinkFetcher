# 02 — Preload & IPC Security

## Regra de ouro

O preload roda em contexto isolado mas ainda tem acesso a Node. Ele é a
**única** ponte entre renderer e main — tudo que ele expõe vira superfície
de ataque acessível a qualquer script que rode no renderer (incluindo
conteúdo de terceiros, se houver).

## `contextBridge` — API mínima e imutável

```ts
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcContract } from '../shared/ipcContract';

const api = Object.freeze({
  checkForUpdate: (): Promise<UpdateCheckResult> =>
    ipcRenderer.invoke('update:check'),

  downloadMedia: (request: DownloadRequest): Promise<DownloadResult> =>
    ipcRenderer.invoke('download:start', validateAtBoundary(request)),

  onDownloadProgress: (cb: (p: DownloadProgress) => void) => {
    const listener = (_: unknown, payload: unknown) => {
      const parsed = DownloadProgressSchema.safeParse(payload);
      if (parsed.success) cb(parsed.data); // nunca repassar payload não validado
    };
    ipcRenderer.on('download:progress', listener);
    return () => ipcRenderer.removeListener('download:progress', listener);
  },
});

contextBridge.exposeInMainWorld('api', api);
```

Regras:

- **Nunca** exponha `ipcRenderer` bruto (`contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer)`)
  — isso dá ao renderer acesso a qualquer canal, presente ou futuro.
- Cada método exposto é uma função nomeada e específica, não um proxy
  genérico (`invoke(channel, ...args)`).
- `Object.freeze` no objeto exposto e em qualquer objeto aninhado — previne
  prototype pollution via `api.__proto__` a partir do renderer.
- Valide **na fronteira do preload**, não só no main — reduz o payload que
  sequer trafega por IPC.

## Arquitetura de canais IPC

Um registro central e tipado de canais, não strings soltas espalhadas pelo
código:

```ts
// shared/ipcContract.ts
export const IPC_CHANNELS = {
  UPDATE_CHECK: 'update:check',
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_PROGRESS: 'download:progress', // main -> renderer, one-way
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
```

No main, cada handler:

1. Valida o **schema** do payload (zod/valibot ou validador manual — ver
   `03-input-validation.md`). Payload inválido = rejeita, loga, nunca tenta
   "corrigir" o dado.
2. Valida **origem** (`event.senderFrame` corresponde à janela principal
   esperada, não a um iframe/webview injetado).
3. Valida **permissão/estado** (ex.: não iniciar segundo download idêntico
   concorrente, não permitir update check antes do app estar pronto).
4. Aplica **rate limiting** por canal (token bucket simples por
   `senderFrame` + canal).
5. Aplica **timeout** na operação (nunca deixar uma Promise de handler
   pendurada indefinidamente).
6. Loga a chamada (canal, resultado, duração) para auditoria — nunca o
   payload bruto se puder conter dado sensível.

```ts
import { ipcMain, type IpcMainInvokeEvent } from 'electron';

function registerHandler<Req, Res>(
  channel: string,
  schema: { parse: (v: unknown) => Req },
  handler: (req: Req, event: IpcMainInvokeEvent) => Promise<Res>,
) {
  const limiter = createRateLimiter({ windowMs: 1000, max: 5 });

  ipcMain.handle(channel, async (event, rawPayload) => {
    if (event.senderFrame?.url !== MAIN_WINDOW_URL) {
      logSecurityEvent('ipc.origin_rejected', { channel });
      throw new Error('rejected');
    }
    if (!limiter.tryAcquire(event.sender.id)) {
      logSecurityEvent('ipc.rate_limited', { channel });
      throw new Error('rate limited');
    }

    let req: Req;
    try {
      req = schema.parse(rawPayload);
    } catch {
      logSecurityEvent('ipc.schema_rejected', { channel });
      throw new Error('invalid payload');
    }

    const started = Date.now();
    try {
      const result = await withTimeout(handler(req, event), 30_000);
      logAudit('ipc.handled', { channel, ms: Date.now() - started });
      return result;
    } catch (err) {
      logSecurityEvent('ipc.handler_failed', { channel });
      throw new Error('operation failed'); // nunca vaze detalhes internos ao renderer
    }
  });
}
```

## Replay / integridade de mensagem

Para canais que disparam ações sensíveis (instalar update, escrever
arquivo), inclua um `nonce`/`requestId` gerado no main e devolvido ao
renderer antes da ação, exigido de volta na chamada — previne que um
handler seja re-invocado fora de sequência por conteúdo malicioso que
capturou uma chamada anterior via timing attack.

## Renderer: nunca confiar em nada vindo do main sem re-validar

Mesmo dados que "vieram do seu próprio main process" devem ser tratados como
não confiáveis no lado do renderer se o renderer alguma vez expõe qualquer
conteúdo de terceiros (iframe, preview, player embutido) — esse conteúdo
pode ter conseguido interceptar/forjar mensagens via prototype pollution do
`window`. Congele `window.api` também do lado do preload como mostrado
acima, e valide schemas nos dois sentidos.
