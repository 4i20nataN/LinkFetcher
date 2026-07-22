# Mapa do App — LinkFetcher

> Guia rápido para o próximo agente. Leia `android-port-gaps.md` para os bugs conhecidos.

---

## Estrutura

```
src/
├── App.tsx                    ← Entry point React, roteamento por tab (useState, sem router)
├── main.tsx                   ← ReactDOM.createRoot
├── index.css                  ← Tailwind + overflow:hidden (⚠️ gap #10)
├── types.ts                   ← Todas as interfaces (DownloadItem, MediaInfo, AppSettings, etc.)
├── global.d.ts                ← Tipagem do window.electron
│
├── context/
│   └── AppContext.tsx          ← Estado global: settings, favorites, downloads, activeTab
│
├── components/
│   ├── Sidebar.tsx            ← Navegação lateral (6 tabs)
│   ├── ThemeWrapper.tsx       ← Accent color + dark/light mode
│   ├── NeuralConstellationBackground.tsx ← Canvas animado (⚠️ gap #15 resize)
│   ├── ParticleBackground.tsx ← Background alternativo
│   └── BlockIcon.tsx          ← Ícones customizados
│
├── core/
│   ├── engine/
│   │   └── DownloadEngine.ts  ← Singleton que gerencia TODA a fila de downloads (866 linhas)
│   ├── ytdlp/
│   │   ├── YtDlpAdapter.ts    ← Router: Electron → Capacitor → HTTP (triple fallback)
│   │   ├── CapacitorYtDlp.ts  ← Wrapper do plugin Capacitor com Proxy anti-thenable
│   │   └── YtDlpManager.ts    ← DEAD CODE no Android (buildArgs para Electron)
│   ├── storage/
│   │   └── Storage.ts         ← CRUD de localStorage (favorites, settings, downloadLater)
│   ├── plugins/
│   │   ├── Providers.ts       ← Detecção de plataforma por URL (regex)
│   │   └── MediaProvider.ts   ← Interface base para providers
│   └── i18n.ts                ← Sistema de tradução (PT/EN/ES)
│
└── features/
    ├── analyzer/
    │   └── LinkAnalyzer.tsx   ← Tela principal: URL input → probe → formatos → download
    ├── downloads/
    │   ├── DownloadManager.tsx← Lista de downloads com progress bar
    │   ├── FormatSelector.tsx ← Slider de qualidade + opções de áudio/vídeo
    │   └── constants.ts       ← Constantes UI
    ├── youtube/
    │   └── YouTubeSearch.tsx  ← Busca de vídeos
    ├── favorites/
    │   └── FavoritesView.tsx  ← Lista de favoritos
    ├── later/
    │   └── DownloadLaterView.tsx ← Lista "baixar depois"
    ├── settings/
    │   └── SettingsView.tsx   ← Configurações + import/export (⚠️ gap #6 folder picker)
    └── update/
        └── UpdateBanner.tsx   ← Auto-update: check → download → install (funciona no Android)
```

---

## Fluxo de Dados

```
URL do usuário
    │
    ▼
LinkAnalyzer.handleAnalyze()
    │
    ▼
YtDlpAdapter.probe(url)  ──── isElectron? ──→ window.electron.invoke('yt-dlp-probe')
    │                           │
    │                     isCapacitor? ──→ CapacitorYtDlp.probe()
    │                           │
    │                     fallback ──→ fetch('/api/probe')
    ▼
MediaInfo (formatos, duração, thumbnail)
    │
    ▼
FormatSelector (usuário escolhe qualidade)
    │
    ▼
DownloadEngine.addDownload(item)
    │
    ▼
DownloadEngine.processQueue()  ──→ maxConcurrent (3)
    │
    ▼
DownloadEngine.startYtDlpDownload(item)
    │
    ├── hasElectronBridge? ──→ window.electron.invoke('yt-dlp-start', args)
    │                              │
    │                        IPC events (progress/complete/error)
    │
    ├── hasCapacitorBridge? ──→ CapacitorYtDlp.download(params)
    │                              │
    │                        Plugin listener 'yt-dlp-progress'
    │
    └── fallback ──→ EventSource SSE para /api/download/start
```

---

## As 3 Camadas de Download

| Camada | Arquivo | Quando usa |
|--------|---------|-----------|
| **Electron IPC** | `DownloadEngine.ts:295-388` | `window.electron.invoke` existe |
| **Capacitor Plugin** | `DownloadEngine.ts:391-488` | `Capacitor.isNativePlatform()` |
| **HTTP SSE** | `DownloadEngine.ts:491-584` | Fallback (server Express rodando) |

**Regra**: Cada camada tem seu handler de progress/complete/error. O Capacitor NÃO parseia `speed` (gap #1).

---

## Pontos de Decisão de Plataforma

O app detecta plataforma com 2 checks:

```typescript
// Em qualquer arquivo:
const isElectron = typeof window !== 'undefined' && !!window.electron;
const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
```

**Onde esses checks aparecem** (fora do adapter):

| Arquivo | Linha | O que faz |
|---------|-------|-----------|
| `DownloadEngine.ts:292-293` | Detecta plataforma para escolher caminho de download |
| `DownloadEngine.ts:588` | Detecta plataforma para openFile |
| `DownloadEngine.ts:684` | Detecta plataforma para proxy download |
| `SettingsView.tsx:42` | `isElectron` para config UI |
| `FormatSelector.tsx:10` | `isWebMode` (inverso de electron) |
| `UpdateBanner.tsx` | Múltiplos checks para auto-update |

---

## Arquivos Críticos para o Porte Android

| Arquivo | Por quê | Linhas-chave |
|---------|---------|-------------|
| `DownloadEngine.ts` | 80% dos gaps estão aqui | 292-488 (Capacitor branch), 586-596 (openFile), 599-700 (proxy) |
| `SettingsView.tsx` | Folder picker, clipboard, config | 42, 59-64, 103-104, 117-141 |
| `LinkAnalyzer.tsx` | Description save, thumbnail download | 321-329, 374-392 |
| `DownloadManager.tsx` | Open folder, share, toasts | 105-121, 147-157 |
| `index.css` | overflow:hidden | 44-46 |
| `YtDlpPlugin.kt` | Null safety probe | Linhas com `fmt.tbr` e `fmt.fps` |
| `AndroidManifest.xml` | Permissões faltantes | POST_NOTIFICATIONS ausente |

---

## Estado Global (AppContext)

```typescript
interface AppContextType {
  settings: AppSettings;          // localStorage['universal_downloader_settings']
  updateSettings: (s) => void;    // Salva no localStorage + atualiza DownloadEngine
  favorites: FavoriteItem[];      // localStorage['universal_downloader_favorites']
  downloadLater: DownloadLaterItem[];
  downloads: DownloadItem[];      // Vem do DownloadEngine via listener
  activeTab: string;              // 'analyze' | 'search' | 'manager' | 'favorites' | 'later' | 'settings'
  selectedUrl: string;            // URL selecionada para analisar
}
```

---

## Tab Routing (sem React Router)

```tsx
// App.tsx:23-39 — roteamento manual por switch
switch (activeTab) {
  case 'analyze':  return <LinkAnalyzer />;
  case 'search':   return <YouTubeSearch />;
  case 'manager':  return <DownloadManager />;
  case 'favorites': return <FavoritesView />;
  case 'later':    return <DownloadLaterView />;
  case 'settings': return <SettingsView />;
}
```

---

## Plugin Capacitor (Kotlin)

```
android/app/src/main/java/com/linkfetcher/app/
├── MainActivity.java        ← registerPlugin(YtDlpPlugin.class)
└── YtDlpPlugin.kt          ← 7 métodos: ensureBinaries, probe, search, download,
                               cancel, openFile, checkUpdate/downloadUpdate/installUpdate
```

**Métodos do plugin** (`CapacitorYtDlp.ts:100-122`):
- `ensureBinaries()` → Download ytdlp/ffmpeg se necessário
- `probe({ url })` → getInfo com timeout 30s
- `search({ query, platform, maxResults })` → ytsearch + --flat-playlist
- `download(params)` → 25+ parâmetros mapeados para args do yt-dlp
- `cancel({ id })` → destroyProcessById + job.cancel
- `openFile({ filePath })` → Intent ACTION_VIEW
- `checkUpdate()` → GitHub API → última release
- `downloadUpdate({ apkUrl })` → Download APK para cache
- `installUpdate({ apkPath })` → Intent ACTION_INSTALL_PACKAGE

**Eventos** (`notifyListeners`):
- `yt-dlp-progress` → `{ id, type: 'progress'|'complete'|'error', percent, eta, speed?, filePath?, message? }`
- `update-progress` → `{ stage: 'downloading', received, total, percent }`

---

## Capacitor Config

```typescript
// capacitor.config.ts
appId: 'com.linkfetcher.app'
webDir: 'dist-web'              // Vite output
server.androidScheme: 'https'   // Permite mixed content
plugins.YtDlp: {}               // Plugin registrado
```

---

## Comandos Úteis

```bash
# Dev Android
npm run build                    # Build Vite (dist-web/) + esbuild (dist/electron/)
npx cap sync android             # Copia dist-web/ para android/
npx cap open android             # Abre Android Studio

# Build release
npm run build && npx cap sync android
# Then build no Android Studio (Generate Signed APK)

# Lint
npm run lint
```

---

## Checklist Rápido ao Corrigir Gap

1. Ler `android-port-gaps.md` → identificar gap
2. Ler o arquivo-alvo COMPLETO (não só o trecho citado)
3. Verificar se o gap afeta其他 plataformas (Electron/Web)
4. Fazer fix com branch `isCapacitor()` ou `isElectron()`
5. Rodar `npm run lint`
6. Adicionar entrada em `docs/session-log.md`
