# Design: FormatSelector Modular UI + Icon System

**Date:** 2026-07-13
**Status:** Approved
**Scope:** FormatSelector.tsx, SettingsView.tsx, types.ts, AppContext.tsx

---

## 1. Goals

- Wrap every logical section in its own modular container with rounded borders
- Add 3-way icon style toggle (Emoji | Lucide Mono | Lucide Color)
- Make block titles bigger and bolder
- Size buttons proportionally to label length
- Split compatible blocks horizontally on desktop (2-col grid)
- Add icons to ALL blocks that currently lack them
- No element removal — pure layout/visual reorganization

---

## 2. Icon Style System

### Settings field
```ts
iconStyle: 'emoji' | 'lucide-mono' | 'lucide-color'
```
Added to `AppSettings` in `types.ts`. Default: `'lucide-mono'`.

### Icon Map
Each block gets an entry in a centralized map:

| Block | Emoji | Lucide Component | Lucide Color class |
|---|---|---|---|
| Resolução | 🎬 | MonitorPlay | text-zinc-400 |
| Formato Vídeo | 📼 | FileVideo | text-zinc-400 |
| Extrair Áudio | 🎵 | Music | text-zinc-400 |
| Formato Áudio | 🔊 | Volume2 | text-zinc-400 |
| Qualidade Áudio | 🎚️ | SlidersHorizontal | text-zinc-400 |
| Legendas | 📝 | Subtitles | text-blue-400 |
| Formato Custom | ✏️ | Pencil | text-zinc-400 |
| Recortar | ✂️ | Scissors | text-amber-400 |
| Modo Saída | 📤 | ArrowDownToLine | text-zinc-400 |
| FPS | ⏱️ | Gauge | text-zinc-400 |
| SponsorBlock | 🛡️ | Shield | text-purple-400 |
| Metadados | 🏷️ | Tag | text-emerald-400 |
| Thumbnail | 🖼️ | Image | text-sky-400 |
| Comportamento | ⚙️ | Settings | text-zinc-400 |
| Fragmentos | ⚡ | Zap | text-zinc-400 |
| Tentativas | 🔄 | RefreshCw | text-zinc-400 |
| Limite Velocidade | 🚀 | Rocket | text-zinc-400 |

### Rendering logic
```tsx
// Pseudocode
function BlockIcon({ blockId, settings }) {
  const style = settings.iconStyle;
  if (style === 'emoji') return <span>{emojiMap[blockId]}</span>;
  const LucideIcon = lucideMap[blockId];
  if (style === 'lucide-color') return <LucideIcon size={14} className={colorMap[blockId]} />;
  return <LucideIcon size={14} className="text-zinc-400" />;
}
```

---

## 3. Container Pattern

Every block wrapped in:
```tsx
<div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
  <div className="flex items-center gap-2">
    <BlockIcon blockId="..." settings={settings} />
    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
      Título do Bloco
    </label>
  </div>
  {children}
</div>
```

**Title change:** `text-[11px] font-semibold` → `text-xs font-bold text-zinc-300`

---

## 4. Proportional Button Sizing

Btn component gains optional `size` prop:
- `'sm'`: `min-w-[48px] px-2` — for 1-3 char labels (24, 30, MP4)
- `'md'`: `min-w-[72px] px-3` — for 4-8 char labels (WebM, Sponsors)
- `'lg'`: `flex-1 px-3` — for 9+ char labels (Sem limite, Nome limpo)

Auto-detect from label length when `size` not explicit.

---

## 5. Horizontal Splits (Desktop)

Pairs that share a row on `sm:` breakpoint:

| Left | Right | Rationale |
|---|---|---|
| Formato Áudio | Qualidade Áudio | Both audio sub-options, same width |
| Modo de Saída | FPS Máximo | Both small button grids |
| Metadados | Thumbnail | Both single toggles |
| Tentativas | Fragmentos | Both small number grids |
| Limite Velocidade | (full width) | 7 buttons need space |

**Pattern:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
  <ContainerBlock>...</ContainerBlock>
  <ContainerBlock>...</ContainerBlock>
</div>
```

---

## 6. Settings Integration

New section in SettingsView alongside "Tema e Aparência":
```
[Ícones]
Estilo: [🎬 Emoji] [Lucide Mono] [Lucide Color]
```
Three toggle buttons with live preview. Persisted via `updateSettings({ iconStyle })`.

---

## 7. Files Modified

1. `src/types.ts` — add `iconStyle` to `AppSettings`
2. `src/context/AppContext.tsx` — default value for `iconStyle`
3. `src/components/BlockIcon.tsx` — **NEW** centralized icon component
4. `src/features/downloads/FormatSelector.tsx` — containers, icons, layout, buttons
5. `src/features/downloads/DownloadManager.tsx` — use BlockIcon for tags
6. `src/features/settings/SettingsView.tsx` — icon style toggle section

---

## 8. Constraints

- No element removal — only repositioning and visual changes
- All existing functionality preserved
- `tsc --noEmit` must pass
- Compatible with web mode (no Electron-specific changes)
- Emoji fallback for platforms that don't render certain emojis
