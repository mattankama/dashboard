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

## Never
Gradients, glassmorphism, glow, heavy shadows, card grids, emoji as icons, pill-badge clutter, purple/blue "AI" palettes, stock icon sets everywhere, bouncy animations.

## Still to ask Mattan (before or during Task 4)
1. Where category is set, and how it shows on the list (or whether it's hidden).
2. How to reach the archived view (e.g. tap the title, or a quiet link at the end of the list).
3. Which serif and which sans to use, and whether to load web fonts or stick to system fonts.
4. Wording: placeholder text, empty state, undo toast.
5. The desktop layout (a centered column?), and the home-screen icon.
