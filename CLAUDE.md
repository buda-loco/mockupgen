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
- **Tailwind CSS 4** (via PostCSS)
- **Framer Motion** — sidebar accordion animations
- **Lucide React** — icon system
- **clsx + tailwind-merge** — className utility (`cn()` helper)

No backend. No database. No API calls. Everything runs client-side.

## Architecture

Three files, one page:

```
src/
├── types/mockup.ts      (752 lines) — Types, constants, object option registry
├── lib/prompt-engine.ts  (296 lines) — Pure function: config → prompt string
└── app/
    ├── page.tsx          (1192 lines) — Entire UI: sidebar + canvas + 3D gizmo
    ├── layout.tsx                     — Root layout (Inter + Playfair Display fonts)
    └── globals.css                    — Tailwind + design tokens
```

### Data Flow

```
User picks options in sidebar
        │
        ▼
MockupConfig (React state)
        │
        ▼
generateMockupPrompt(config)  ← pure function, no side effects
        │
        ▼
Prompt string displayed in canvas → Copy to clipboard
```

### Design System

```
Background:  #F9F8F6  (warm cream)
Foreground:  #1A1A1A  (near-black)
Accent:      #A68B6A  (warm bronze)
Border:      #E5E2DD  (light gray)
Fonts:       Inter (sans), Playfair Display (serif)
```

## File Reference

### `src/types/mockup.ts`

The single source of truth for all options. Contains:

- **Type definitions** — `ObjectType`, `CameraAngle`, `SurfaceType`, `SettingType`, `LightingType`, `MaterialType`, `ImageRatio`, `AssetInputType`, `PropType`, `HandMode`, `ScreenEffectType`, `ImperfectionType`, `CustomAngle`
- **MockupConfig interface** — flat config object with ~22 fields, stored as React state
- **Category arrays** — `PRINT_OBJECTS`, `FABRIC_OBJECTS`, `SCREEN_OBJECTS`, `SIGNAGE_OBJECTS` — used for conditional UI rendering
- **Constant arrays** — `OBJECTS`, `CAMERAS`, `SURFACES`, `SETTINGS`, `LIGHTINGS`, `MATERIALS`, etc. All follow `{ id: string, label: string }[]` shape
- **Object Option Registry** (`OBJECT_OPTIONS`) — the per-object customization system (see below)
- **Imperfection arrays** — `IMPERFECTIONS_UNIVERSAL`, `IMPERFECTIONS_SCREEN`, `IMPERFECTIONS_FABRIC`, `IMPERFECTIONS_PRINT`, `IMPERFECTIONS_HARD`

### `src/lib/prompt-engine.ts`

Pure function `generateMockupPrompt(config: MockupConfig) → string`. Assembles prompt in this order:

1. Core photography style (Hasselblad, 100MP, editorial)
2. Image ratio
3. Object description
4. **Object-specific details** (from OBJECT_OPTIONS registry)
5. Camera angle (preset or custom 3D angle → natural language)
6. Surface + Setting (or infinite background)
7. Lighting + intensity
8. Material finish
9. Asset input type + dimensions
10. Asset description
11. Props
12. Hand interaction
13. Screen effects (screen objects only)
14. Imperfections
15. Color palette (hex swatches + mood text)
16. Render suffix (UE5, 8K, ray tracing)

Each category has a `Record<string, string>` prompt map. The `customAngleToPrompt()` function converts pitch/yaw degrees to natural language ("from above at 30°, rotated slightly to the right").

### `src/app/page.tsx`

Single client component containing:

- **AngleWidget** — Blender-style 3D rotation gizmo (SVG-based). Three colored axis rings (X=red pitch, Y=green yaw, Z=blue free), outer trackball, and a rotating 3D slab with "FRONT" label. Drag rings to constrain rotation to one axis. Includes preset buttons (Top/Front/3/4/Low).
- **TogglePill** — Reusable single/multi-select button component
- **extractColorsFromImage()** — Client-side median cut color extraction from uploaded images (no server). Samples at 150px max, skips transparent/extreme pixels, produces up to 5 dominant hex colors.
- **Main MockupGenerator component** — Sidebar (340px) with accordion sections + preview canvas

## Object System (24 objects)

### Categories

| Category | Objects |
|----------|---------|
| Print | business-cards, letterhead, book-magazine, product-box, poster-print, notebook, brand-identity, vinyl-cd, shopping-bag, restaurant-menu |
| Fabric | tshirt, tote-bag, flag |
| Screen | phone-screen, laptop-screen, desktop-monitor, imac |
| Hard Surface | coffee-mug, bottle-label |
| Signage | signage, billboard, bus-ad, bus-stop, pull-up-banner |

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

## Sidebar Sections (15 total)

| Section | Visibility | Type |
|---------|-----------|------|
| Image Ratio | Always | Single-select (8 ratios) |
| Object | Always | Single-select (24 objects) |
| Object Details | When object has entries in OBJECT_OPTIONS | Dynamic per-object options |
| Asset Input | Always | Single-select + conditional dimensions field |
| Camera Angle | Always | Single-select (7 presets + 3D custom) |
| Surface | Hidden when infinite BG on | Single-select (12 surfaces) |
| Setting | Hidden when infinite BG on | Single-select (10 settings) |
| Lighting | Always | Single-select (14 options) + intensity slider |
| Colors | Always | Up to 5 hex swatches + extract from image |
| Props | Always | Multi-select (16 props) |
| Hand | Always | Single-select (4 modes) |
| Screen Effects | Screen objects only | Multi-select (3 effects) |
| Imperfections | Always (options vary by category) | Multi-select |
| Infinite Background | Always | Toggle + color picker |
| Brand Details | Always | Text inputs (description, palette, material) |

## 3D Angle Widget

SVG-based Blender-style gizmo:
- **Three axis rings** projected from 3D to 2D, split into front/back halves for depth rendering
- **Outer trackball ring** (dashed) for free rotation
- **3D slab** inside the gizmo — backface-culled rectangular solid with labeled "FRONT" face
- **Hit detection** via `distToPolyline()` — measures mouse distance to each ring's polyline path
- **Axis-constrained dragging** — X ring controls pitch, Y ring controls yaw, Z/trackball = free
- **Preset buttons**: Top (80°/0°), Front (0°/0°), 3/4 (30°/35°), Low (-25°/15°)
- Front face of slab is at positive Z (faces camera at pitch=0, yaw=0)

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
- Colors: accent is `#A68B6A`, active states use `ring-1 ring-[#A68B6A]`
- Labels are `text-[9px] font-bold tracking-widest text-[#999] uppercase`
- Accordion sections use Framer Motion `AnimatePresence` with height animation
- The `cn()` helper wraps `clsx` + `tailwind-merge` for className composition
- Keep everything in 3 files — no component extraction unless page.tsx exceeds ~2000 lines
- Object-specific logic goes in the registry, not in if/else branches
