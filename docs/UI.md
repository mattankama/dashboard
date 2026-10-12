# UI guidelines

Mattan owns the UI's design. **Ask before any visual or interaction choice not settled here** (offer 2–4 options with small mockups), then record the answer below. Use the `frontend-ui-engineering` and `frontend-design` skills.

## Feel
A calm, pleasant everyday planner, not a generic "vibe-coded" app. Simple, nothing extra.

## Decided (2026-10-11)
- **Dark theme only.** A warm near-black background, not pure `#000` and not blue-gray.
- **One accent color: warm amber.** Shades of it are fine; no second hue. Use it sparingly: pins (★), focus, the caret and the send arrow. Everything else is warm neutrals.
- **Paper-planner type:** serif for item text, small sans for labels and metadata. Generous line height.
- **Add field at the bottom, always visible,** like a messaging app. There's no Add button: the keyboard's return key (or a small ↵ arrow) saves.
- **Item actions:** swipe left to archive (with undo), tap to edit in place. Pinning lives in the edit view. Every swipe action must also be reachable without swiping (from the edit view) for mouse and keyboard users.
- **No visible buttons that could live in a menu or gesture.** The list shows only the items.

## Decided from the options page (2026-10-11)
Options page: https://claude.ai/artifact/4XDzBZaW3WPE2JxbcbraZa
- **Dot-grid journal page:** a faint dot grid behind the list, as in a bullet journal. A muted dash starts each item; a honey ★ replaces it on pinned items. Each mark covers the dot it sits on (Mattan's review of the first screen).
- **Serif: Charter** (built into iPhone and Mac; no font files). Labels use the system sans.
- **Amber: Honey** (`#e2a651`). Page `#1c1814`, text `#ebe1d2`, muted `#a39582`, dots `#4a3e33`.
- **No categories in the UI.** The API's optional `category` field stays but the UI never sets it, so the sheet's fallback is one list.
- **Top of the page: today's date,** like a planner page (e.g. "Sunday, October 11").
- **Spacing:** one blank dot row between items, so every item has a finger-sized tap area.
- **Placeholder:** "Worth remembering…". **Empty page:** "A clean page."
- **Laptop:** a phone-width page centered in the window, with plain darker space (`#13100d`) around it.

## Never
Gradients, glassmorphism, glow, heavy shadows, card grids, emoji as icons, pill-badge clutter, purple/blue "AI" palettes, stock icon sets everywhere, bouncy animations, middle-dot meta strings ("A · B").

## Still to ask Mattan
1. Wording of the undo toast (Task 6).
2. How to reach the archived view (Task 7).
3. The home-screen icon (Task 10).
