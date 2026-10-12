# UI guidelines

Mattan owns the UI's design. **Ask before any visual or interaction choice not settled here** (offer 2–4 options with small mockups), then record the answer below. Use the `frontend-ui-engineering` and `frontend-design` skills.

## Feel
A calm, pleasant everyday planner, not a generic "vibe-coded" app. Simple, nothing extra.

## Decided (2026-10-11)
- **Dark theme only.** A warm near-black background, not pure `#000` and not blue-gray.
- **One accent color: warm amber.** Shades of it are fine; no second hue. Use it sparingly: pins (★), focus, the caret and the send arrow. Everything else is warm neutrals.
- **Paper-planner type:** serif for item text, small sans for labels and metadata. Generous line height.
- **Add field at the bottom, always visible,** like a messaging app. There's no Add button: the keyboard's return key (or a small ↵ arrow) saves.
- **Item actions:** on the phone, actions are swipes; on a laptop (no swiping), they're quiet words that appear on tap. Mattan accepted that phone actions aren't reachable with VoiceOver.
- **No visible buttons that could live in a menu or gesture.** The list shows only the items.

## Decided from the options page (2026-10-11)
Options page: https://claude.ai/artifact/4XDzBZaW3WPE2JxbcbraZa
- **Dot-grid journal page:** a faint dot grid behind the list, as in a bullet journal. A muted dash starts each item; a honey ★ replaces it on pinned items. Each mark covers the dot it sits on, and the text sits on that same line of dots (both from Mattan's reviews).
- **Serif: Charter** (built into iPhone and Mac; no font files). Labels use the system sans.
- **Amber: Honey** (`#e2a651`). Page `#1c1814`, text `#ebe1d2`, muted `#a39582`, dots `#4a3e33`.
- **No categories in the UI.** The API's optional `category` field stays but the UI never sets it, so the sheet's fallback is one list.
- **Top of the page: today's date,** like a planner page (e.g. "Sunday, October 11").
- **Spacing:** one blank dot row between items, so every item has a finger-sized tap area.
- **Placeholder:** "Worth remembering…". **Empty page:** "A clean page."
- **Laptop:** a phone-width page centered in the window, with plain darker space (`#13100d`) around it.
- **Editing:** tap an item to edit its text in place. Return or tapping elsewhere saves; Esc cancels. No Save button. On a laptop, the quiet words "Pin" (or "Unpin") and "Archive" appear under it.
- **Swipes (phone, today's page):** left archives, right pins or unpins. Nothing is revealed; the item follows the finger and acts once it's past halfway.
- **Undo lines:** "Archived", "Restored" or "Deleted" with "Undo", just above the add field, for about 5 seconds. A delete is only sent once its line goes away.
- **Archive view:** tap the date to flip to the archive (the heading becomes "Archived"); tap it again to come back. The add field is hidden there. An empty archive says "Nothing archived yet." On the phone, swipe left restores and swipe right deletes, with no confirmation. On a laptop, tapping an archived item shows "Restore" and "Delete".
- **Home-screen icon:** a dot grid with one dot marked in honey (`apps/web/public/icon.svg`, plus PNGs rendered from it).

## Never
Gradients, glassmorphism, glow, heavy shadows, card grids, emoji as icons, pill-badge clutter, purple/blue "AI" palettes, stock icon sets everywhere, bouncy animations, middle-dot meta strings ("A · B").

## Still to ask Mattan
Nothing open. Ask before any new visual or interaction choice.
