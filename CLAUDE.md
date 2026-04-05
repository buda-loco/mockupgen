# Nano Banana Pro — Mockup Studio

AI-powered mockup photography prompt generator for brand designers. Generates consistent, high-quality prompts for image generation tools (Nano Banana / Midjourney / etc.) from a visual configuration UI.

## Quick Start

```bash
npm run dev    # Dev server on localhost:3000
npm run build  # Production build (also runs TypeScript check)
npm run lint   # ESLint
```

## Tech Stack

- **Next.js 16** + React 19 + TypeScript 5
- **Tailwind CSS 4** (via PostCSS) — default palette only, no custom CSS properties
- **Framer Motion** — step transitions, accordion animations
- **Lucide React** — icon system
- **clsx + tailwind-merge** — className utility (`cn()` helper)

No backend. No database. No API calls. Everything runs client-side.

## Architecture

Three files, one page:

```
src/
├── types/mockup.ts      (~950 lines) — Types, constants, object option registry
├── lib/prompt-engine.ts  (~320 lines) — Pure function: config → prompt string
└── app/
    ├── page.tsx          (~2400 lines) — Entire UI: wizard + studio + 3D gizmo
    ├── layout.tsx                      — Root layout (system font stack)
    └── globals.css                     — Just @import "tailwindcss" (no custom CSS)
```

### Data Flow

```
User picks options (wizard steps or studio tabs)
        │
        ▼
MockupConfig (React state)
        │
        ▼
generateMockupPrompt(config)  ← pure function, no side effects
        │
        ▼
Live prompt displayed in preview → Copy to clipboard (text or JSON)
```

### UI Modes

Two modes, toggled via header button, preference saved to localStorage:

```
WIZARD MODE (default):
  Full-screen step-by-step flow (9 steps)
  One question at a time, large cards, animated transitions
  Progress dots at top, Back/Next navigation

STUDIO MODE (power user):
  Horizontal tab bar: Object │ Camera │ Scene │ Lighting │ Input │ Extras
  Split layout: options panel (left) + live prompt preview (right)
  Mobile: prompt in slide-up bottom sheet
```

### Styling

Using **default Tailwind classes only** — no custom CSS properties or design tokens.

```
Dark palette:   gray-950 / gray-900 / gray-800 (backgrounds)
Text:           gray-100 / gray-400 / gray-500
Accent:         indigo-400 / indigo-500 (active states, buttons)
Active states:  border-indigo-400 bg-indigo-500/10 text-indigo-400 (outlined)
Buttons:        bg-indigo-500 text-white (primary CTAs)
Font:           System stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
```

## File Reference

### `src/types/mockup.ts`

The single source of truth for all options. Contains:

- **Type definitions** — `ObjectType`, `CameraAngle`, `SurfaceType`, `SettingType`, `LightingType`, `MaterialType`, `ImageRatio`, `AssetInputType`, `AssetRatioType`, `PropType`, `HandMode`, `ScreenEffectType`, `ImperfectionType`, `CustomAngle`
- **MockupConfig interface** — flat config object with ~25 fields, stored as React state
- **Category arrays** — `PRINT_OBJECTS`, `FABRIC_OBJECTS`, `SCREEN_OBJECTS`, `SIGNAGE_OBJECTS` — used for conditional UI rendering
- **Constant arrays** — `OBJECTS`, `CAMERAS`, `SURFACES`, `SETTINGS`, `LIGHTINGS`, `MATERIALS`, `IMAGE_RATIOS`, `ASSET_RATIOS`, `ASSET_INPUTS`, `PROPS`, `HANDS`, `SCREEN_EFFECTS` — all follow `{ id: string, label: string }[]` shape
- **Object Option Registry** (`OBJECT_OPTIONS`) — the per-object customization system (see below)
- **Imperfection arrays** — `IMPERFECTIONS_UNIVERSAL`, `IMPERFECTIONS_SCREEN`, `IMPERFECTIONS_FABRIC`, `IMPERFECTIONS_PRINT`, `IMPERFECTIONS_HARD`

### `src/lib/prompt-engine.ts`

Pure function `generateMockupPrompt(config: MockupConfig) → string`. Assembles prompt in this order:

1. Core photography style (Hasselblad, 100MP, editorial)
2. Image ratio (output image proportions)
3. Object description
4. **Object-specific details** (from OBJECT_OPTIONS registry)
5. Camera angle (preset or custom 3D angle → natural language)
6. Surface + Setting (or infinite background)
7. Lighting + intensity
8. Material finish (print objects only)
9. Asset input type + dimensions
10. **Asset ratio / proportions** (input image proportions — preserves exact mapping)
11. **Asset fidelity instructions** (CRITICAL block: no text distortion, no proportion changes)
12. Asset description
13. Props
14. Hand interaction
15. Screen effects (screen objects only)
16. Imperfections
17. Color palette (hex swatches + mood text)
18. Render suffix (UE5, 8K, ray tracing)

Each category has a `Record<string, string>` prompt map. The `customAngleToPrompt()` function converts pitch/yaw degrees to natural language.

### `src/app/page.tsx`

Single client component containing:

- **AngleWidget** — Blender-style 3D rotation gizmo (SVG-based). Three colored axis rings (X=red pitch, Y=green yaw, Z=blue free), outer trackball, and a rotating 3D slab with "FRONT" label.
- **TogglePill** — Reusable single/multi-select button component
- **ColorSwatchesUI** — Inline component for color swatch management + image extraction
- **extractColorsFromImage()** — Client-side median cut color extraction (no server)
- **getPromptSegments()** — Splits generated prompt into labeled sections for structured display
- **Wizard mode** — 9-step flow with animated transitions
- **Studio mode** — 6-tab horizontal layout with live prompt preview
- **Preset system** — 12 built-in presets + user presets via localStorage

## Object System (32 objects)

### Categories

| Category | Objects |
|----------|---------|
| Print | business-cards, letterhead, book-magazine, product-box, poster-print, notebook, brand-identity, vinyl-cd, shopping-bag, restaurant-menu, postcard, newspaper, magazine-ad, tri-fold-flyer, envelope |
| Fabric | tshirt, tote-bag, flag |
| Screen | phone-screen, laptop-screen, desktop-monitor, imac, tablet-apple, tablet-android |
| Hard Surface | coffee-mug, bottle-label |
| Signage | signage, billboard, bus-ad, bus-stop, pull-up-banner, exhibition-stand |

### Per-Object Option Registry Pattern

The `OBJECT_OPTIONS` registry in `mockup.ts` maps each object to its unique options. Each entry is an `ObjectOptionDef`:

```ts
interface ObjectOptionDef {
  key: string;        // config key (e.g. "corner")
  label: string;      // UI label (e.g. "Corner Type")
  choices: {
    id: string;       // option value (e.g. "rounded")
    label: string;    // UI label (e.g. "Rounded")
    prompt: string;   // prompt fragment (e.g. "with softly rounded corners")
  }[];
  default: string;    // default choice id
}
```

Selected values stored in `config.objectDetails: Record<string, string>` (flat key→id map). When the user switches objects, `objectDetails` resets to the new object's defaults via `getObjectDefaults()`.

**To add a new object:**
1. Add its ID to `ObjectType` union
2. Add to `OBJECTS` constant array
3. Add to the appropriate category array (PRINT_OBJECTS, etc.)
4. Add its entry to `OBJECT_OPTIONS` with options + prompt fragments
5. Add its `OBJECT_PROMPTS` entry in `prompt-engine.ts`
6. Add an icon mapping in `OBJECT_ICONS` in `page.tsx`

No structural changes needed. The UI renders generically from the registry.

## Studio Tabs (6 total)

| Tab | Contains |
|-----|----------|
| Object | Object selector (with search + category filter tabs), Object Details, Material Finish (print objects only) |
| Camera | Camera Angle (7 presets + 3D custom), Image Ratio (output proportions) |
| Scene | Surface, Setting, Infinite Background toggle + color |
| Lighting | Lighting style (14 options), Intensity slider |
| Input | Asset Input type, **Asset Proportions** (input image ratio), Color Swatches, Palette Description, Asset Description |
| Extras | Props, Hand, Screen Effects (screen objects only), Imperfections |

## Wizard Steps (9 total)

| Step | Title | Content |
|------|-------|---------|
| 0 | Quick Start | Built-in presets grid + user presets + "Start fresh" |
| 1 | What are we making? | Object selector with search + categories |
| 2 | Customize your {object} | Object Details + Material (print only). Auto-skips if no options. |
| 3 | How should it look? | Camera Angle + Image Ratio |
| 4 | Set the scene. | Surface + Setting + Infinite BG |
| 5 | Light it up. | Lighting + Intensity |
| 6 | Configure your input. | Asset type, Asset proportions, Colors, Brand description |
| 7 | Add some flair. | Props, Hand, Screen FX, Imperfections (skippable) |
| 8 | Review | Structured prompt preview, Copy (text/JSON), Save preset |

## Dual Ratio System

Two separate ratio configurations:

```
IMAGE RATIO (Camera tab / Step 3):
  Controls the OUTPUT image proportions (1:1, 4:5, 4:3, 16:9, etc.)
  → Tells the AI what shape the final generated image should be

ASSET RATIO (Input tab / Step 6):
  Controls the INPUT asset proportions (auto, 1:1, 3:2, 16:9, 3:1, custom, etc.)
  → Tells the AI the exact proportions of the attached reference image
  → Prevents stretching/distortion when mapping onto mockup surfaces
  → "auto" = no explicit ratio instruction (AI figures it out)
```

## Asset Fidelity System

Every generated prompt includes a CRITICAL INSTRUCTION block that explicitly tells the AI:
- Do NOT alter, redraw, or reinterpret any part of the provided asset
- ALL text must remain EXACTLY as written (same words, font, size, spacing)
- ALL proportions must be preserved (no stretching, squishing, cropping)
- Treat the asset as a sacred, unmodifiable reference

When `assetRatio` is set (not 'auto'), an additional block specifies the exact ratio and instructs uniform scaling with margins rather than distortion.

## Preset System

- **12 built-in presets** — common branding mockup setups (Business Card Flat Lay, Phone App Showcase, Brand Identity Spread, etc.)
- **User presets** — saved to `localStorage` under key `nb-presets`
- **Schema migration** — loading a preset uses `{ ...DEFAULT_CONFIG, ...preset.config }` spread so new fields get defaults automatically
- **localStorage** wrapped in try/catch for private browsing / quota exceeded

## 3D Angle Widget

SVG-based Blender-style gizmo:
- **Three axis rings** projected from 3D to 2D, split into front/back halves for depth rendering
- **Outer trackball ring** (dashed) for free rotation
- **3D slab** inside the gizmo — backface-culled rectangular solid with labeled "FRONT" face
- **Hit detection** via `distToPolyline()` — measures mouse distance to each ring's polyline path
- **Axis-constrained dragging** — X ring controls pitch, Y ring controls yaw, Z/trackball = free
- **Preset buttons**: Top (80°/0°), Front (0°/0°), 3/4 (30°/35°), Low (-25°/15°)

## Color Extraction

`extractColorsFromImage(file, count)` — fully client-side:
1. Load image via `URL.createObjectURL()`
2. Draw to canvas at max 150px (for speed)
3. Read pixel data via `getImageData()`
4. Filter out transparent, near-black (<15), near-white (>240) pixels
5. Median cut algorithm: recursively split pixel buckets along widest-range channel
6. Average each bucket → sort by hue → return hex strings
7. Revoke object URL

## Conventions

- All option arrays follow `{ id: string, label: string }[] as const` shape
- Prompt maps are `Record<string, string>` keyed by option id
- UI uses `TogglePill` for all single/multi select options — consistent look
- Active states: `border-indigo-400 bg-indigo-500/10 text-indigo-400` (outlined, not solid)
- Primary CTAs: `bg-indigo-500 text-white`
- Labels: `text-sm font-medium text-gray-400`
- Framer Motion `AnimatePresence` for step transitions and accordions
- The `cn()` helper wraps `clsx` + `tailwind-merge` for className composition
- Keep everything in 3 files — no component extraction unless page.tsx exceeds ~3000 lines
- Object-specific logic goes in the registry, not in if/else branches
- Material Finish lives in Object Details (shown only for PRINT_OBJECTS), NOT in Brand Details
