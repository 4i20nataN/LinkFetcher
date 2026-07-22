# FormatSelector UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the FormatSelector from a functional but flat interface into a professional-grade UI with visual hierarchy, micro-interactions, and a download summary panel — matching the polish of IDM / 4K Video Downloader.

**Architecture:** All changes are confined to 3 files: `FormatSelector.tsx` (bulk), `BlockIcon.tsx` (icons/titles), `LinkAnalyzer.tsx` (download button + summary). No backend changes. No new dependencies.

**Tech Stack:** React 19, TypeScript, Tailwind 4, motion/react (framer-motion), lucide-react

## Global Constraints

- No new npm packages — use only what's already in package.json
- All text in PT-BR (with EN fallback via `settings.language`)
- Must pass `npx tsc --noEmit` after each task
- No `any` types
- Preserve all existing functionality — this is visual-only refactor
- Branch: `feat/ui-redesign`

---

## Task 1: BlockTitle Sentence Case + Button Pill Shape

**Files:**
- Modify: `src/components/BlockIcon.tsx:90-92`
- Modify: `src/features/downloads/FormatSelector.tsx:500-513` (Btn component)

**Interfaces:**
- Consumes: nothing new
- Produces: BlockTitle renders sentence case; Btn has pill shape

- [ ] **Step 1: Change BlockTitle from uppercase to sentence case**

```tsx
// src/components/BlockIcon.tsx:90-92
// BEFORE:
export const BlockTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide">{children}</label>
);

// AFTER:
export const BlockTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-xs font-bold text-zinc-300 tracking-wide">{children}</label>
);
```

- [ ] **Step 2: Change Btn border-radius to pill shape (12px)**

```tsx
// src/features/downloads/FormatSelector.tsx:500-513
// Change the Btn component's border-radius from rounded-lg to rounded-xl
// BEFORE:
className={`
  border rounded-lg text-[11px] font-bold transition-all text-center
  ...

// AFTER:
className={`
  border rounded-xl text-[11px] font-bold transition-all text-center
  ...
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/BlockIcon.tsx src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): sentence case titles + pill-shaped buttons"
```

---

## Task 2: Resolution Labels with Descriptors

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:53-61` (VIDEO_PRESETS)

**Interfaces:**
- Consumes: nothing new
- Produces: VIDEO_PRESETS has descriptive labels

- [ ] **Step 1: Update VIDEO_PRESETS labels**

```tsx
// src/features/downloads/FormatSelector.tsx:53-61
const VIDEO_PRESETS = [
  { id: 'best', label: '★★★★ Melhor', height: Infinity, format: 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b' },
  { id: '2160p', label: '4K Ultra', height: 2160, format: 'bv*[height<=2160][ext=mp4]+ba[ext=m4a]/b[height<=2160]' },
  { id: '1440p', label: '1440 QHD', height: 1440, format: 'bv*[height<=1440][ext=mp4]+ba[ext=m4a]/b[height<=1440]' },
  { id: '1080p', label: '1080 Full HD', height: 1080, format: 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]' },
  { id: '720p', label: '720 HD', height: 720, format: 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]' },
  { id: '480p', label: '480 SD', height: 480, format: 'bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480]' },
  { id: '360p', label: '360 Baixa', height: 360, format: 'bv*[height<=360][ext=mp4]+ba[ext=m4a]/b[height<=360]' },
] as const;
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): descriptive resolution labels (4K Ultra, 1080 Full HD, etc)"
```

---

## Task 3: Audio Quality Labels + FPS Labels

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:79-86` (AUDIO_QUALITY_PRESETS)
- Modify: `src/features/downloads/FormatSelector.tsx:847-853` (FPS buttons)

**Interfaces:**
- Consumes: nothing new
- Produces: Audio shows "kbps", FPS shows "FPS" suffix

- [ ] **Step 1: Update AUDIO_QUALITY_PRESETS**

```tsx
// src/features/downloads/FormatSelector.tsx:79-86
const AUDIO_QUALITY_PRESETS = [
  { value: '0', label: 'Melhor', desc: 'Qualidade maxima' },
  { value: '3', label: '320 kbps', desc: '' },
  { value: '4', label: '256 kbps', desc: '' },
  { value: '5', label: '192 kbps', desc: '' },
  { value: '7', label: '128 kbps', desc: '' },
  { value: '9', label: '64 kbps', desc: '' },
] as const;
```

- [ ] **Step 2: Update FPS labels**

```tsx
// src/features/downloads/FormatSelector.tsx:847-853
// BEFORE:
{[0, 24, 30, 60, 120].map(fps => (
  <Btn key={fps} active={options.fpsMax === fps} onClick={() => update({ fpsMax: fps })} className="py-2 flex-1">
    {fps === 0 ? 'Auto' : `${fps}`}
  </Btn>
))}

// AFTER:
{[0, 24, 30, 60, 120].map(fps => (
  <Btn key={fps} active={options.fpsMax === fps} onClick={() => update({ fpsMax: fps })} className="py-2 flex-1">
    {fps === 0 ? 'Original' : `${fps} FPS`}
  </Btn>
))}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): audio kbps labels + FPS suffix + Original label"
```

---

## Task 4: Button Active State Redesign (CTA Pattern)

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:500-513` (Btn component)

**Interfaces:**
- Consumes: accentBg, accentBorder from settings
- Produces: Active buttons use bg #282B33 + border accent + white text. Only download button stays fully colored.

- [ ] **Step 1: Redesign Btn active state**

```tsx
// src/features/downloads/FormatSelector.tsx:500-513
const Btn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }> = ({ active, onClick, children, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      border rounded-xl text-[11px] font-bold transition-all text-center
      ${disabled ? 'bg-zinc-900/20 border-white/5 text-zinc-600 cursor-not-allowed' :
        active ? 'bg-[#282B33] border-white/15 text-white' : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}
      ${className}
    `}
  >
    {active && <span className="mr-1">✔</span>}
    {children}
  </button>
);
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): active buttons use #282B33 bg + checkmark, CTA reserved for download"
```

---

## Task 5: Micro-Animations on Button Select

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:500-513` (Btn component)

**Interfaces:**
- Consumes: motion/react already imported
- Produces: Buttons scale to 102% with shadow on active

- [ ] **Step 1: Wrap Btn in motion.button for scale animation**

```tsx
// src/features/downloads/FormatSelector.tsx:500-513
// Replace the Btn component with motion.button
const Btn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }> = ({ active, onClick, children, className = '', disabled = false }) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    whileTap={{ scale: 0.97 }}
    animate={active ? { scale: 1.02, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' } : { scale: 1, boxShadow: '0 0px 0px rgba(0,0,0,0)' }}
    transition={{ duration: 0.2 }}
    className={`
      border rounded-xl text-[11px] font-bold transition-colors text-center
      ${disabled ? 'bg-zinc-900/20 border-white/5 text-zinc-600 cursor-not-allowed' :
        active ? 'bg-[#282B33] border-white/15 text-white' : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}
      ${className}
    `}
  >
    {active && <span className="mr-1">✔</span>}
    {children}
  </motion.button>
);
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): micro-animation 102% scale + shadow on active buttons"
```

---

## Task 6: Switches 15% Larger + Smoother Animation

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:476-498` (Toggle and SmallToggle)

**Interfaces:**
- Consumes: nothing new
- Produces: Larger switches with smoother transition

- [ ] **Step 1: Update Toggle switch dimensions**

```tsx
// Toggle switch (line 485-486):
// BEFORE:
<button onClick={onChange} className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? accentBg : 'bg-zinc-700'}`}>
  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-md ${value ? 'left-[26px]' : 'left-1'}`} />
</button>

// AFTER:
<button onClick={onChange} className={`relative w-[52px] h-[28px] rounded-full transition-colors duration-300 shrink-0 ${value ? accentBg : 'bg-zinc-700'}`}>
  <div className={`absolute top-[3px] w-5 h-5 rounded-full bg-white transition-all duration-300 shadow-md ${value ? 'left-[27px]' : 'left-[3px]'}`} />
</button>
```

- [ ] **Step 2: Update SmallToggle switch dimensions**

```tsx
// SmallToggle switch (line 494-495):
// BEFORE:
<button onClick={onChange} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${value ? accentBg : 'bg-zinc-800'}`}>
  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'left-[18px]' : 'left-0.5'}`} />
</button>

// AFTER:
<button onClick={onChange} className={`relative w-[42px] h-[24px] rounded-full transition-colors duration-300 shrink-0 ${value ? accentBg : 'bg-zinc-800'}`}>
  <div className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all duration-300 ${value ? 'left-[21px]' : 'left-[3px]'}`} />
</button>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): switches 15% larger with 300ms smooth animation"
```

---

## Task 7: Vertical Spacing Between Groups + Thumbnail Size

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:516` (main container)
- Modify: `src/features/downloads/FormatSelector.tsx:536-544` (thumbnail card)
- Modify: `src/features/downloads/FormatSelector.tsx:423-439` (image preview card)

**Interfaces:**
- Consumes: nothing new
- Produces: 16px spacing between groups, 64x64 thumbnail

- [ ] **Step 1: Change main container spacing from space-y-3 to space-y-4**

```tsx
// Line 516:
// BEFORE:
<div className="space-y-3">

// AFTER:
<div className="space-y-4">
```

- [ ] **Step 2: Enlarge video thumbnail to 64x64**

```tsx
// Line 537-538:
// BEFORE:
<div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 bg-zinc-950 shrink-0">

// AFTER:
<div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-zinc-950 shrink-0">
```

- [ ] **Step 3: Enlarge image preview thumbnail to 64x64**

```tsx
// Line 424:
// BEFORE:
<div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-zinc-950 shrink-0">

// Already 64x64 — no change needed.
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): 16px group spacing + 64x64 video thumbnail"
```

---

## Task 8: Secondary Info with Icons + Video Card Enhancement

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:536-544` (video info card)
- Modify: `src/features/analyzer/LinkAnalyzer.tsx` (mediaInfo display area)

**Interfaces:**
- Consumes: mediaInfo (formats.length, duration, sizeEst)
- Produces: Info card shows icon-labeled rows

- [ ] **Step 1: Redesign video info card with icon-labeled rows**

```tsx
// src/features/downloads/FormatSelector.tsx:536-544
// BEFORE:
<div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/40 border border-white/5">
  <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 bg-zinc-950 shrink-0">
    <img src={mediaInfo.thumbnailUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
  </div>
  <div className="min-w-0 flex-1">
    <p className="text-[11px] font-semibold text-white truncate">{mediaInfo.title}</p>
    <p className="text-[10px] text-zinc-500 font-mono">{mediaInfo.formats.length} formatos{mediaInfo.duration ? ` • ${mediaInfo.duration}` : ''}</p>
  </div>
</div>

// AFTER:
<div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/40 border border-white/5">
  <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-zinc-950 shrink-0">
    <img src={mediaInfo.thumbnailUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
  </div>
  <div className="min-w-0 flex-1 space-y-1">
    <p className="text-[12px] font-semibold text-white truncate">{mediaInfo.title}</p>
    <div className="flex items-center gap-3 flex-wrap">
      <span className="flex items-center gap-1 text-[10px] text-zinc-400">
        <ListOrdered size={10} /> {mediaInfo.formats.length} formatos
      </span>
      {mediaInfo.duration && (
        <span className="flex items-center gap-1 text-[10px] text-zinc-400">
          <Clock size={10} /> {mediaInfo.duration}
        </span>
      )}
      {mediaInfo.sizeEst && mediaInfo.sizeEst !== 'N/A' && (
        <span className="flex items-center gap-1 text-[10px] text-zinc-400">
          <ArrowDownToLine size={10} /> {mediaInfo.sizeEst}
        </span>
      )}
    </div>
  </div>
</div>
```

Note: Add `ListOrdered, Clock, ArrowDownToLine` to the import from lucide-react at the top of FormatSelector.tsx if not already imported. Check existing imports first.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): video info card with icon-labeled rows (formats, duration, size)"
```

---

## Task 9: Tabs with Bottom Indicator

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:517-534` (tab bar)

**Interfaces:**
- Consumes: nothing new
- Produces: Tabs have underline indicator instead of filled background

- [ ] **Step 1: Redesign tab bar with underline indicator**

```tsx
// src/features/downloads/FormatSelector.tsx:517-534
// BEFORE:
<div className="flex gap-1 p-1 rounded-xl bg-zinc-900/60 border border-white/5">
  {([
    { id: 'media' as TabId, blockId: 'video-format' as BlockId, label: 'Mídia' },
    { id: 'advanced' as TabId, blockId: 'behavior' as BlockId, label: 'Avançado' },
  ]).map(tab => {
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${isActive ? `${accentBg} ${accentTextOnBg} shadow-lg` : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
      >
        <BlockIcon blockId={tab.blockId} size={14} />
        {tab.label}
      </button>
    );
  })}
</div>

// AFTER:
<div className="flex gap-1 border-b border-white/5">
  {([
    { id: 'media' as TabId, blockId: 'video-format' as BlockId, label: 'Mídia' },
    { id: 'advanced' as TabId, blockId: 'behavior' as BlockId, label: 'Avançado' },
  ]).map(tab => {
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all relative ${isActive ? accentText : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        <BlockIcon blockId={tab.blockId} size={14} />
        {tab.label}
        {isActive && (
          <motion.div
            layoutId="tab-indicator"
            className={`absolute bottom-0 left-0 right-0 h-0.5 ${accentBg}`}
            transition={{ duration: 0.2 }}
          />
        )}
      </button>
    );
  })}
</div>
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): tabs with animated underline indicator"
```

---

## Task 10: SponsorBlock as Checkboxes

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:857-877` (SponsorBlock section)

**Interfaces:**
- Consumes: nothing new
- Produces: SponsorBlock uses checkbox chips instead of radio buttons

- [ ] **Step 1: Replace SponsorBlock buttons with checkbox chips**

```tsx
// src/features/downloads/FormatSelector.tsx:857-877
// BEFORE:
<div className={`p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2 ${isWebMode ? 'opacity-40 pointer-events-none' : ''}`}>
  <div className="flex items-center gap-2">
    <BlockIcon blockId="sponsorblock" />
    <BlockTitle>SponsorBlock</BlockTitle>
    {isWebMode && <DesktopOnlyTag />}
  </div>
  <p className="text-[10px] text-zinc-600">Remover automaticamente partes indesejadas do video</p>
  <div className="grid grid-cols-2 gap-1.5">
    {[
      { id: '', label: 'Desligado' },
      { id: 'sponsor', label: 'Sponsors' },
      { id: 'intro,outro,preview', label: 'Intro/Outro' },
      { id: 'all', label: 'Remover Tudo' },
    ].map(opt => (
      <Btn key={opt.id} active={options.sponsorblockRemove === opt.id} onClick={() => update({ sponsorblockRemove: opt.id })} className="py-2">
        {opt.label}
      </Btn>
    ))}
  </div>
</div>

// AFTER:
<div className={`p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2 ${isWebMode ? 'opacity-40 pointer-events-none' : ''}`}>
  <div className="flex items-center gap-2">
    <BlockIcon blockId="sponsorblock" />
    <BlockTitle>SponsorBlock</BlockTitle>
    {isWebMode && <DesktopOnlyTag />}
  </div>
  <p className="text-[10px] text-zinc-600">Remover automaticamente partes indesejadas do video</p>
  <div className="flex flex-wrap gap-1.5">
    {[
      { id: 'sponsor', label: 'Sponsors' },
      { id: 'intro', label: 'Intro' },
      { id: 'outro', label: 'Outro' },
      { id: 'preview', label: 'Preview' },
      { id: 'selfpromo', label: 'Self Promo' },
      { id: 'interaction', label: 'Interaction' },
    ].map(opt => {
      const selected = options.sponsorblockRemove?.split(',').includes(opt.id) || options.sponsorblockRemove === 'all';
      return (
        <button
          key={opt.id}
          onClick={() => {
            const current = options.sponsorblockRemove?.split(',').filter(Boolean) || [];
            const next = selected
              ? current.filter(id => id !== opt.id)
              : [...current, opt.id];
            update({ sponsorblockRemove: next.join(',') });
          }}
          className={`
            px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition-all
            ${selected ? 'bg-[#282B33] border-white/15 text-white' : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-zinc-200'}
          `}
        >
          {selected && <span className="mr-1">✔</span>}
          {opt.label}
        </button>
      );
    })}
  </div>
</div>
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): SponsorBlock as multi-select checkbox chips"
```

---

## Task 11: Filename Templates

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:550-569` (filename section)

**Interfaces:**
- Consumes: nothing new
- Produces: Filename input has template chips below

- [ ] **Step 1: Add template chips below filename input**

```tsx
// After the restrictFilenames toggle (line 568), add template chips:
<div className="flex flex-wrap gap-1.5">
  {[
    { template: '%(title)s', label: 'Título' },
    { template: '%(uploader)s', label: 'Canal' },
    { template: '%(upload_date)s', label: 'Data' },
    { template: '%(resolution)s', label: 'Resolução' },
  ].map(tpl => (
    <button
      key={tpl.template}
      onClick={() => {
        const current = options.customFilename || '';
        update({ customFilename: current ? `${current} ${tpl.template}` : tpl.template });
      }}
      className="px-2 py-1 rounded-lg bg-zinc-800/60 border border-white/5 text-[9px] font-mono text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
    >
      {tpl.label}
    </button>
  ))}
</div>
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "feat(ui): filename template chips (title, channel, date, resolution)"
```

---

## Task 12: Tooltips on Options

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx` (add Tooltip wrapper component)

**Interfaces:**
- Consumes: nothing new
- Produces: Hoverable tooltips on codec, format, and resolution options

- [ ] **Step 1: Add a simple Tooltip component**

```tsx
// Add after the SmallToggle component (around line 498):
const TooltipWrapper: React.FC<{ tip: string; children: React.ReactNode }> = ({ tip, children }) => (
  <div className="relative group/tip inline-flex">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-[10px] text-zinc-300 whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-50 shadow-xl">
      {tip}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
    </div>
  </div>
);
```

- [ ] **Step 2: Wrap codec buttons with tooltips**

```tsx
// In the VIDEO_CODECS section (line 634-654), wrap each Btn:
{VIDEO_CODECS.map(codec => (
  <TooltipWrapper key={codec.id} tip={
    codec.id === 'h264' ? 'Codec universal. Maior compatibilidade.' :
    codec.id === 'h265' ? 'Maior compressão. Pode não funcionar em TVs antigas.' :
    codec.id === 'vp9' ? 'Open source. Bom para YouTube e WebM.' :
    codec.id === 'av01' ? 'Codec moderno. Maior compressão. Suporte crescente.' :
    'Escolha automaticamente o melhor codec.'
  }>
    <Btn
      active={options.videoCodec === codec.id}
      onClick={() => { /* existing logic */ }}
      className="py-2 flex-1"
    >
      {codec.label}
    </Btn>
  </TooltipWrapper>
))}
```

Note: Keep the existing onClick logic for codec selection intact.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "feat(ui): hover tooltips on codec and format options"
```

---

## Task 13: Dangerous Options Separated + Footer Bar

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:913-923` (Comportamento section)
- Modify: `src/features/analyzer/LinkAnalyzer.tsx:541-545` (footer text)

**Interfaces:**
- Consumes: nothing new
- Produces: Dangerous options in "Avançado" sub-section, footer as bar with folder link

- [ ] **Step 1: Add warning styling to dangerous options**

```tsx
// src/features/downloads/FormatSelector.tsx:913-923
// BEFORE:
<div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
  <div className="flex items-center gap-2">
    <BlockIcon blockId="behavior" />
    <BlockTitle>Comportamento</BlockTitle>
  </div>
  <div className="space-y-1.5">
    <SmallToggle value={!!options.noOverwrites} onChange={() => update({ noOverwrites: !options.noOverwrites })} label="Nao sobrescrever arquivos existentes" />
    <SmallToggle value={!!options.keepVideo} onChange={() => update({ keepVideo: !options.keepVideo })} label="Manter video apos extrair audio" />
  </div>
</div>

// AFTER:
<div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
  <div className="flex items-center gap-2">
    <BlockIcon blockId="behavior" />
    <BlockTitle>Comportamento de arquivos</BlockTitle>
  </div>
  <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-1.5">
    <div className="flex items-center gap-1.5 mb-1">
      <AlertTriangle size={11} className="text-amber-400" />
      <span className="text-[10px] text-amber-400/80 font-medium">Avançado</span>
    </div>
    <SmallToggle value={!!options.noOverwrites} onChange={() => update({ noOverwrites: !options.noOverwrites })} label="Não sobrescrever arquivos existentes" />
    <SmallToggle value={!!options.keepVideo} onChange={() => update({ keepVideo: !options.keepVideo })} label="Manter video apos extrair audio" />
  </div>
</div>
```

Note: Add `AlertTriangle` to the lucide-react import if not already present.

- [ ] **Step 2: Redesign footer as info bar with folder link**

```tsx
// src/features/analyzer/LinkAnalyzer.tsx:541-545
// BEFORE:
<div className="flex items-center gap-2.5 text-xs text-zinc-400 font-medium">
  <Info size={14} className="text-zinc-500" />
  <span>{settings.language === 'en' ? 'The file will be saved in your configured download directory.' : 'O arquivo será salvo no diretório de downloads configurado no programa.'}</span>
</div>

// AFTER:
<div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/40 border border-white/5">
  <Info size={14} className="text-zinc-500 shrink-0" />
  <span className="text-[11px] text-zinc-400 flex-1">
    {settings.language === 'en' ? 'Saved to:' : 'Salvo em:'} <span className="text-zinc-300 font-medium">{settings.defaultDir || 'Downloads'}</span>
  </span>
  <button
    onClick={() => {
      const dir = settings.defaultDir || '';
      if (dir && window.electron) {
        window.electron.invoke('shell:openPath', dir);
      }
    }}
    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors font-medium shrink-0"
  >
    Alterar pasta
  </button>
</div>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx src/features/analyzer/LinkAnalyzer.tsx
git commit -m "refactor(ui): dangerous options in amber warning box + footer info bar with folder link"
```

---

## Task 14: Download Button Enhancement + Summary Panel

**Files:**
- Modify: `src/features/analyzer/LinkAnalyzer.tsx:540-558` (download button area)

**Interfaces:**
- Consumes: selectedFormat, formatOptions, mediaInfo
- Produces: Download button shows format summary + description

- [ ] **Step 1: Add summary panel above download button**

```tsx
// src/features/analyzer/LinkAnalyzer.tsx:540-558
// BEFORE:
<div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
  <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-medium">
    <Info size={14} className="text-zinc-500" />
    <span>{settings.language === 'en' ? 'The file will be saved in your configured download directory.' : 'O arquivo será salvo no diretório de downloads configurado no programa.'}</span>
  </div>
  
  <button
    onClick={handleStartDownload}
    disabled={!selectedFormat}
    className={`
      w-full sm:w-auto px-6 py-3 rounded-xl text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all
      ${getAccentBgClass(settings)} hover:scale-[1.02] active:scale-[0.98]
    `}
  >
    <Download size={18} />
    {t('btnDownloadSelected')}
  </button>
</div>

// AFTER:
<div className="border-t border-white/5 pt-4 space-y-3">
  {/* Summary Panel */}
  {selectedFormat && (
    <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Resultado</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="flex items-center gap-1.5">
          <FileVideo size={11} className="text-zinc-500" />
          <span className="text-[11px] text-zinc-300 font-medium">
            {selectedFormat.ext?.toUpperCase() || 'N/A'}
          </span>
        </div>
        {selectedFormat.quality && selectedFormat.quality !== 'N/A' && (
          <div className="flex items-center gap-1.5">
            <MonitorPlay size={11} className="text-zinc-500" />
            <span className="text-[11px] text-zinc-300 font-medium">
              {selectedFormat.quality}
            </span>
          </div>
        )}
        {formatOptions?.audioOnly && (
          <div className="flex items-center gap-1.5">
            <Music size={11} className="text-zinc-500" />
            <span className="text-[11px] text-zinc-300 font-medium">
              {formatOptions.audioFormat?.toUpperCase()} {formatOptions.audioQuality !== '0' ? `${AUDIO_QUALITY_PRESETS.find(q => q.value === formatOptions.audioQuality)?.label || ''}` : 'Melhor'}
            </span>
          </div>
        )}
        {mediaInfo.duration && (
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-zinc-500" />
            <span className="text-[11px] text-zinc-300 font-medium">{mediaInfo.duration}</span>
          </div>
        )}
        {formatOptions?.downloadSections && (
          <div className="flex items-center gap-1.5">
            <Scissors size={11} className="text-zinc-500" />
            <span className="text-[11px] text-zinc-300 font-medium">Corte ativo</span>
          </div>
        )}
        {formatOptions?.sponsorblockRemove && (
          <div className="flex items-center gap-1.5">
            <Shield size={11} className="text-zinc-500" />
            <span className="text-[11px] text-zinc-300 font-medium">SponsorBlock</span>
          </div>
        )}
      </div>
    </div>
  )}

  {/* Footer info bar */}
  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/40 border border-white/5">
    <Info size={14} className="text-zinc-500 shrink-0" />
    <span className="text-[11px] text-zinc-400 flex-1">
      {settings.language === 'en' ? 'Saved to:' : 'Salvo em:'} <span className="text-zinc-300 font-medium">{settings.defaultDir || 'Downloads'}</span>
    </span>
  </div>

  {/* Download Button */}
  <div className="flex flex-col items-center gap-1">
    <button
      onClick={handleStartDownload}
      disabled={!selectedFormat}
      className={`
        w-full sm:w-auto px-8 py-3.5 rounded-xl text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all
        ${getAccentBgClass(settings)} hover:scale-[1.02] active:scale-[0.98]
      `}
    >
      <Download size={18} />
      {t('btnDownloadSelected')}
    </button>
    {selectedFormat && (
      <span className="text-[10px] text-zinc-500">
        {selectedFormat.ext?.toUpperCase()} • {selectedFormat.quality || 'Melhor qualidade'}
        {formatOptions?.audioOnly && ` • ${formatOptions.audioFormat?.toUpperCase()}`}
      </span>
    )}
  </div>
</div>
```

Note: Add `FileVideo, MonitorPlay, Music, Clock, Scissors, Shield` to the lucide-react import in LinkAnalyzer.tsx if not already present.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/analyzer/LinkAnalyzer.tsx
git commit -m "feat(ui): download summary panel + enhanced download button with format description"
```

---

## Task 15: Export FormatOptions for Summary Panel

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx:25-51` (export FormatOptions)

**Interfaces:**
- Consumes: nothing new
- Produces: FormatOptions is exported (already is — verify)

- [ ] **Step 1: Verify FormatOptions is already exported**

Check line 25: `export interface FormatOptions` — already exported. No change needed.

- [ ] **Step 2: Verify AUDIO_QUALITY_PRESETS is accessible from LinkAnalyzer**

Since AUDIO_QUALITY_PRESETS is a const in FormatSelector.tsx, it needs to be exported or duplicated. Export it:

```tsx
// Change line 79:
// BEFORE:
const AUDIO_QUALITY_PRESETS = [

// AFTER:
export const AUDIO_QUALITY_PRESETS = [
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "refactor(ui): export AUDIO_QUALITY_PRESETS for summary panel"
```

---

## Task 16: Tooltip for SponsorBlock Description

**Files:**
- Modify: `src/features/downloads/FormatSelector.tsx` (SponsorBlock section)

**Interfaces:**
- Consumes: TooltipWrapper from Task 12
- Produces: SponsorBlock chips have individual tooltips

- [ ] **Step 1: Add tooltips to SponsorBlock chips**

In the SponsorBlock section from Task 10, wrap each chip button with TooltipWrapper:

```tsx
{[
  { id: 'sponsor', label: 'Sponsors', tip: 'Patrocinadores pagos no video' },
  { id: 'intro', label: 'Intro', tip: 'Introducao do video' },
  { id: 'outro', label: 'Outro', tip: 'Encerramento / links externos' },
  { id: 'preview', label: 'Preview', tip: 'Preview de proximos videos' },
  { id: 'selfpromo', label: 'Self Promo', tip: 'Autor promovendo conteudo proprio' },
  { id: 'interaction', label: 'Interaction', tip: 'Pedidos de like, inscricao, etc.' },
].map(opt => (
  <TooltipWrapper key={opt.id} tip={opt.tip}>
    <button ...>
      {opt.label}
    </button>
  </TooltipWrapper>
))}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/downloads/FormatSelector.tsx
git commit -m "feat(ui): SponsorBlock chips with descriptive tooltips"
```

---

## Deferred Items (Not in this plan)

- **#8 Trim bar redesign** — Premiere-style with tooltip and mini-frames. Deferred: requires significant TimeRangeSlider rewrite and potentially yt-dlp frame extraction API which may not be available.
- **#9 Preview frames on trim** — User explicitly said to defer if complex.
- **#26 Dropdown menus for format/codec/audio/fps** — Significant UX change that would require careful testing. Better as a separate iteration.

---

## Execution Summary

| Task | Description | Files Changed | Risk |
|------|-------------|---------------|------|
| 1 | Sentence case titles + pill buttons | BlockIcon.tsx, FormatSelector.tsx | Low |
| 2 | Resolution labels | FormatSelector.tsx | Low |
| 3 | Audio kbps + FPS labels | FormatSelector.tsx | Low |
| 4 | Button active state #282B33 | FormatSelector.tsx | Low |
| 5 | Micro-animations on buttons | FormatSelector.tsx | Low |
| 6 | Larger switches | FormatSelector.tsx | Low |
| 7 | Spacing + thumbnail | FormatSelector.tsx | Low |
| 8 | Info card with icons | FormatSelector.tsx | Low |
| 9 | Tab underline indicator | FormatSelector.tsx | Low |
| 10 | SponsorBlock checkboxes | FormatSelector.tsx | Medium |
| 11 | Filename templates | FormatSelector.tsx | Low |
| 12 | Tooltips | FormatSelector.tsx | Low |
| 13 | Dangerous options + footer | FormatSelector.tsx, LinkAnalyzer.tsx | Medium |
| 14 | Download summary panel | LinkAnalyzer.tsx | Medium |
| 15 | Export constants | FormatSelector.tsx | Low |
| 16 | SponsorBlock tooltips | FormatSelector.tsx | Low |

Total: 16 tasks, 0 new files, ~3 files modified.
