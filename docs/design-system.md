# Design System — LinkFetcher

## Design Philosophy

| Principle | Implementation |
|-----------|----------------|
| **Nothing OS aesthetic** | Dark glassmorphism, mesh gradients, frosted glass panels |
| **Density over whitespace** | Compact controls, high information density |
| **Keyboard-first** | All interactive elements focusable, logical tab order |
| **State clarity** | Loading/success/error states on every action |
| **Dual-mode parity** | Electron + Web share identical UI components |

---

## Color System (Tailwind CSS v4)

```css
/* src/index.css — defined via @theme */
--color-bg-base: #0a0a0b;           /* zinc-950 */
--color-bg-elevated: #18181b;       /* zinc-900 */
--color-bg-glass: rgba(24,24,27,0.7); /* backdrop-blur bg-zinc-900/70 */
--color-border: rgba(255,255,255,0.05); /* border-white/5 */
--color-border-strong: rgba(255,255,255,0.1); /* border-white/10 */
--color-text-primary: #fafafa;      /* zinc-50 */
--color-text-secondary: #a1a1aa;    /* zinc-400 */
--color-text-muted: #71717a;        /* zinc-500 */
--color-accent: var(--accent-hue);  /* Dynamic: indigo/emerald/violet/amber/rose/cyan */
```

### Accent Palette (User-selectable in Settings)

| ID | Hex | Tailwind | Use Case |
|----|-----|----------|----------|
| `indigo` | `#6366f1` | `indigo-500` | Default |
| `emerald` | `#10b981` | `emerald-500` | Success states |
| `violet` | `#8b5cf6` | `violet-500` | Premium feel |
| `amber` | `#f59e0b` | `amber-500` | Warnings |
| `rose` | `#f43f5e` | `rose-500` | Errors/Destructive |
| `cyan` | `#06b6d4` | `cyan-500` | Info/Links |

**Helper classes** (in `ThemeWrapper.tsx`):
```tsx
getAccentBgClass(settings)     // e.g., "bg-indigo-500/20"
getAccentTextClass(settings)   // e.g., "text-indigo-400"
getAccentBorderClass(settings) // e.g., "border-indigo-500/30"
getAccentRingClass(settings)   // e.g., "focus:ring-indigo-500/20"
```

---

## Layout Architecture

```
App (h-screen, overflow-hidden)
├─ ThemeWrapper (h-full, relative, overflow-hidden)
│  ├─ Mesh Gradients (fixed, blur, pointer-events-none)
│  ├─ Sidebar (fixed left, h-full, w-64 lg:w-72)
│  └─ Main (flex-1, overflow-y-auto, p-4 md:p-8)
│     └─ Page Content (LinkAnalyzer / YouTubeSearch / Settings / Downloads)
```

### Critical Layout Rules

| Rule | Enforcement |
|------|-------------|
| **No double scroll** | Root `html,body,#root { height: 100%; overflow: hidden }` + Main `overflow-y-auto` |
| **Sidebar never scrolls** | Fixed height, `pb-28` for bottom padding |
| **Mesh gradients stay behind** | `z-0` on gradients, `z-10` on content wrapper |
| **Mobile breakpoint** | `lg:` (1024px) — sidebar collapses to overlay |

### ThemeWrapper Mesh Gradients (Static positions)

```tsx
// Top-right indigo glow
<absolute top-[-10%] right-[10%] w-[350px] h-[350px] rounded-full bg-indigo-500/5 blur-[100px] />
// Bottom-left emerald glow
<absolute bottom-[-10%] left-[20%] w-[450px] h-[450px] rounded-full bg-emerald-500/3 blur-[120px] />
// Center subtle indigo
<absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-indigo-500/4 blur-[120px] />
// Bottom-left subtle indigo
<absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-indigo-500/4 blur-[120px] />
```

---

## Component Patterns

### 1. Glass Panel (Base container)

```tsx
<div className="rounded-xl bg-zinc-900/40 border border-white/5 backdrop-blur-sm">
  {/* Content */}
</div>
```

**Variants**:
- `p-3` — compact (Settings sections)
- `p-4` — standard (Cards)
- `p-6` — spacious (Empty states)

### 2. Button System

| Variant | Class | Usage |
|---------|-------|-------|
| **Primary** | `bg-{accent} text-white border-{accent} hover:opacity-90` | Main CTAs (Download, Apply) |
| **Secondary** | `bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800` | Secondary actions |
| **Ghost** | `text-zinc-500 hover:text-zinc-300` | Inline links, toggles |
| **Danger** | `bg-rose-500/20 border-rose-500/30 text-rose-400 hover:bg-rose-500/30` | Delete, Cancel |
| **Icon-only** | `p-1.5 rounded-lg` + `size-14` | Toolbar actions |

**Sizes**: `text-xs py-2 px-4` (default), `text-[11px] py-1.5 px-2.5` (compact), `text-sm py-3 px-6` (large)

### 3. Toggle Switch (Reusable)

```tsx
// Used everywhere: Settings, FormatSelector, Providers
<button
  className={`relative w-11 h-6 rounded-full transition-colors ${
    value ? accentBg : 'bg-zinc-800'
  }`}
  onClick={onChange}
>
  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
    value ? 'left-[26px]' : 'left-0.5'
  }`} />
</button>
```

### 4. Select / Dropdown (Native `<select>` styled)

```tsx
<select className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/5
  text-sm font-mono text-white placeholder-zinc-600
  focus:outline-none focus:border-white/15 appearance-none">
  <option value="">Label</option>
</select>
```

### 5. Input Fields

```tsx
// Text input
<input className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/5
  text-sm font-mono text-white placeholder-zinc-600
  focus:outline-none focus:border-white/15 transition-colors" />

// Range slider (custom CSS in index.css)
<input type="range" className="range-slider w-full h-1.5" />
```

---

## FormatSelector — Component Anatomy (Most Complex)

```
FormatSelector
├─ Header Tabs: [Media] [Advanced]  (motion.div animate)
├─ Media Info Card (thumbnail + title + format count)
│
├─ TAB: Media
│  ├─ Resolution Preset Grid (4 cols) — Btn components
│  ├─ Video Format Toggle (MP4/MKV/WebM) — Btn row
│  ├─ Audio Only Toggle — Switch component
│  ├─ Audio Format Grid (conditional opacity)
│  ├─ Audio Quality Grid (0-9 presets)
│  ├─ Subtitles Toggle → expands: Auto-subs, Language, Format, Embed
│  ├─ Custom Format Input (chevron expand)
│
└─ TAB: Advanced
   ├─ Time Range Trim (dual slider + time inputs) — TimeRangeSlider
   ├─ Output Mode (Video+Audio / Video Only / Audio Only) — Btn group
   ├─ Max FPS Grid (Auto/24/30/60/120)
   ├─ Speed Limit Grid (Settings-driven, read-only here)
   ├─ SponsorBlock Grid (Off / Sponsor / Intro+Outro / All)
   ├─ Metadata Toggle — Switch
   ├─ Thumbnail Toggle → Embed Thumbnail (nested)
   ├─ Behavior Toggles (Restrict filenames, No overwrite, Keep video)
   ├─ Concurrent Fragments Grid (1/2/4/8/16)
   └─ Retries Grid (1/3/5/10)
```

### Key Implementation Details

| Feature | Implementation |
|---------|----------------|
| **Tabs** | `AnimatePresence mode="wait"` + `motion.div` key=`media`/`advanced` |
| **Trim Slider** | Dual `<input type="range">` with CSS overlay track; synced time inputs |
| **State sync** | Single `FormatOptions` object; `useCallback` updater + `useEffect` → `onFormatSelect` |
| **Section collapse** | `motion.div` with `height: auto` animate (subtitles, custom format) |
| **Disabled states** | `Btn` component accepts `disabled` prop; grays out + `cursor-not-allowed` |

---

## Icon System

**Library**: `lucide-react` (tree-shakeable)

| Icon | Semantic Use |
|------|--------------|
| `FileVideo` | Media tab, video formats |
| `SlidersHorizontal` | Advanced tab |
| `ChevronDown/Up` | Collapsible sections |
| `Scissors` | Time trim |
| `Shield` | SponsorBlock |
| `Gauge` | Speed limit |
| `Info` | Informational hints |
| `Check` | Active preset/button |
| `Settings2` | Header actions |
| `Download` | Download actions |
| `FolderOpen` | Open folder |
| `ExternalLink` | Open in browser |

**Size scale**: `size={12}` (inline), `size={13}` (toggles), `size={14}` (buttons), `size={16}` (headers)

---

## Motion / Animation (Framer Motion)

| Pattern | Config |
|---------|--------|
| **Tab switch** | `initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:0.15}}` |
| **Collapse** | `initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}` |
| **Toggle knob** | CSS `transition: transform 0.1s ease` (no Framer) |
| **Button press** | `whileTap={{scale:0.97}}` on `motion.button` |
| **Toast/Success** | `AnimatePresence` + `motion.div` slide from bottom |

**Reduced motion**: Respects `prefers-reduced-motion` via Tailwind `motion-reduce:transition-none`

---

## Typography Scale

| Role | Class | Size | Weight |
|------|-------|------|--------|
| **Display** | `font-display text-2xl md:text-3xl` | 24-30px | Bold |
| **Heading** | `font-display font-bold text-lg` | 18px | Bold |
| **Subheading** | `font-semibold text-sm` | 14px | Semibold |
| **Body** | `text-sm` | 14px | Normal |
| **Caption** | `text-[11px]` | 11px | Normal |
| **Micro** | `text-[10px]` | 10px | Normal |
| **Mono** | `font-mono` | — | — |
| **Uppercase label** | `uppercase tracking-wide text-[11px] font-semibold` | 11px | Semibold |

**Fonts**: `--font-sans: "Geist Variable", sans-serif` (via `next/font` equivalent in Vite)

---

## Spacing System (Tailwind-based)

| Token | Value | Use |
|-------|-------|-----|
| `space-y-1` | 4px | Tight stacks (toggles) |
| `space-y-2` | 8px | Standard stacks |
| `space-y-3` | 12px | Section gaps |
| `space-y-4` | 16px | Card gaps |
| `p-2` | 8px | Compact padding |
| `p-3` | 12px | Standard padding |
| `p-4` | 16px | Card padding |
| `gap-1.5` | 6px | Grid gaps |
| `gap-2` | 8px | Button gaps |

---

## Responsive Breakpoints

| Breakpoint | Tailwind | Behavior |
|------------|----------|----------|
| `< 640px` | (default) | Mobile: stacked grids, full-width buttons |
| `≥ 640px` | `sm:` | 2-col grids |
| `≥ 768px` | `md:` | 3-col grids, side padding |
| `≥ 1024px` | `lg:` | Sidebar visible, 4-col grids |
| `≥ 1280px` | `xl:` | Max content width |

---

## Accessibility Checklist

- [ ] All interactive elements: `focus-visible:ring-2 focus-visible:ring-{accent}/20`
- [ ] Color contrast: WCAG AA on all text (zinc-50 on zinc-900 = 15.8:1)
- [ ] ARIA labels on icon-only buttons (`aria-label="Close sidebar"`)
- [ ] Semantic HTML: `<button>`, `<label>`, `<input>`, `<select>`
- [ ] Reduced motion: `motion-reduce:transition-none` on animated elements
- [ ] Keyboard navigation: Tab order logical, Escape closes modals/dropdowns

---

## Adding New UI Components

1. **Create** in `src/components/` (shared) or `src/features/*/` (feature-specific)
2. **Follow** glass panel + accent border pattern
3. **Export** types from `src/types.ts` if shared
4. **Document** props in component JSDoc
5. **Test** in both Electron + Web modes

---

## Deprecated / Avoid

| Pattern | Replacement |
|---------|-------------|
| `min-h-screen` on root | `h-screen` + `overflow-hidden` |
| Custom scrollbar CSS | Native (thin, dark) — no custom needed |
| `shadow-lg` on cards | Glass border `border-white/5` + backdrop blur |
| Bright colors (red-500, green-500) | Accent system via `getAccent*Class()` |
| Hardcoded `indigo-500` | Dynamic accent from Settings |