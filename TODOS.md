# TODOS — Nano Banana Pro

Generated from CEO-level review (2026-04-06). SCOPE EXPANSION mode.

---

## Phase 1 — Foundation (Current)

### P1-1: URL State Encoding
**Priority:** P1 | **Effort:** M | **Depends on:** Nothing
Encode MockupConfig into URL hash using base64+compression. Every config change updates the URL. Loading a URL restores the config.
- **Why:** Transforms from local utility to shareable product. Enables: sharing configs with teammates, bookmarking setups, linking from portfolios, browser back/forward navigation.
- **How to apply:** Use `lz-string` or similar to compress JSON config into URL hash. Debounce URL updates to avoid history spam. Fall back to DEFAULT_CONFIG on invalid hash.

### P1-2: Structured Prompt Engine
**Priority:** P1 | **Effort:** S | **Depends on:** Nothing
Refactor `generateMockupPrompt()` to return `{ segments: {label, text}[], fullText: string }` instead of a plain string. Remove `getPromptSegments()` from page.tsx entirely.
- **Why:** Current `getPromptSegments()` (page.tsx lines 576-626) reverse-engineers prompt structure by string-matching heuristics — fragile, breaks when prompt text changes.
- **How to apply:** Build segments array as `parts` accumulate in the engine. Each push gets a label. Join for fullText. Single source of truth.

### P1-3: Extract Shared Option Renderers
**Priority:** P2 | **Effort:** M | **Depends on:** Nothing
Extract shared option blocks (ObjectSelector, CameraSelector, LightingSelector, etc.) that accept a `compact` prop for layout variation. Used by both wizard and studio modes.
- **Why:** Wizard and studio implement the same options twice — ~800 lines of near-duplication. Adding a new option requires two code changes. Violates DRY.
- **How to apply:** Create shared renderer functions outside MockupGenerator. Accept `compact?: boolean` for layout differences. Replace duplicated code in both modes.

### P1-4: Extract Inner Components
**Priority:** P2 | **Effort:** S | **Depends on:** Nothing
Move `ColorSwatchesUI`, `ModeSwitcher`, and `PromptPreview` outside of `MockupGenerator` as proper components receiving props.
- **Why:** Currently defined as arrow functions inside render scope (lines 885, 933, 967). Recreated every render, preventing React.memo optimization and causing unnecessary DOM teardowns. Correctness fix, not just style.

### P1-5: Error Handling Fixes
**Priority:** P1 | **Effort:** S | **Depends on:** Nothing
1. `extractColorsFromImage()`: Add `img.onerror` handler + null check for `getContext('2d')`.
2. `navigator.clipboard.writeText()`: Add try/catch with fallback textarea copy method.
- **Why:** Two silent failure modes. Image extraction silently breaks on invalid files. Clipboard copy silently fails when permission denied (common in some browsers).

### P1-6: Prompt Length Warning
**Priority:** P3 | **Effort:** S | **Depends on:** Nothing
Show a subtle warning near the word count when prompt exceeds practical limits for common AI tools (~500 words). Different AI tools truncate at different lengths.
- **Why:** Prompts routinely hit 300+ words. Midjourney truncates at ~60 words, DALL-E at ~400 chars. Users waste time on detail that gets silently dropped.

### P1-7: Local Usage Analytics
**Priority:** P3 | **Effort:** S | **Depends on:** Nothing
Client-side analytics stored in localStorage: object popularity, preset usage, wizard completion rate (step drop-off), wizard vs studio preference. Hidden developer panel to view.
- **Why:** Understanding actual usage patterns is critical for prioritizing improvements. Zero privacy concerns since everything stays local.

### P1-8: Git + Vercel Deployment
**Priority:** P1 | **Effort:** S | **Depends on:** Nothing
Initialize git repo, push to GitHub, connect Vercel for automatic deployment.
- **Why:** No git repo exists. Can't share the app with anyone. Vercel free tier handles Next.js static sites with zero config. Enables preview deployments for branches.

---

## Phase 2 — Professional Tool

### P2-1: Multi-Model Prompt Profiles
**Priority:** P1 | **Effort:** M | **Depends on:** P1-2 (Structured Engine)
Add a "Target Model" selector (Midjourney / DALL-E / Flux / Full) that adjusts prompt verbosity and style. The prompt engine's pure-function design makes this straightforward — swap prompt maps based on model selection.
- **Why:** Current prompts are 300+ words. Midjourney truncates at ~60 words. Different models respond to different prompt styles. Expands addressable user base significantly.

### P2-2: Undo/Redo
**Priority:** P2 | **Effort:** S | **Depends on:** Nothing
Config history stack with Cmd+Z/Cmd+Shift+Z support. Simple array of past states with a pointer.
- **Why:** Creative tools need undo. Users experiment freely when they know they can go back. "I liked the lighting I had 3 changes ago" is a real scenario.

### P2-3: Keyboard Shortcuts
**Priority:** P2 | **Effort:** S | **Depends on:** Nothing
Arrow keys for wizard steps, number keys (1-9) for jump, Cmd+C for copy, Cmd+S for save preset, Tab for studio tabs. '?' overlay to discover shortcuts (like GitHub).
- **Why:** Power users in studio mode need keyboard-driven workflow. Reduces friction for repeat use.

### P2-4: Prompt Diff Highlighting
**Priority:** P3 | **Effort:** S | **Depends on:** P1-2 (Structured Engine)
When a setting changes, briefly highlight the affected segment in the live prompt preview. Subtle flash or underline.
- **Why:** Users immediately see cause-and-effect of every choice. Builds mental model of how the tool works. Builds trust in prompt quality.

### P2-5: Smart Preset Suggestions
**Priority:** P3 | **Effort:** S | **Depends on:** Nothing
After selecting an object, suggest 2-3 presets that use that object type. "Quick setup: Business Card Flat Lay" on the wizard object step.
- **Why:** Reduces path from "I want a business card mockup" to "done" from 9 steps to 2. Contextual suggestions feel intelligent.

### P2-6: Randomize Button
**Priority:** P3 | **Effort:** S | **Depends on:** Nothing
"Surprise me" button that generates a weighted-random config. Not fully random — weighted toward good combinations (e.g., golden-hour + botanical, not neon-glow + white-studio).
- **Why:** Sparks creative discovery for users who don't know what they want. Makes the tool feel playful.

---

## Phase 3 — Platform (Vision)

- Direct AI API integration (generate without leaving the app)
- Brand kit system (save brand colors/fonts/assets, apply across mockups)
- Multi-object scene composition
- Prompt history + A/B comparison
- Community preset marketplace
- Export config as shareable .json files
