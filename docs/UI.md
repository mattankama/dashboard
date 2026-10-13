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
- **Dot-grid journal page:** a faint dot grid behind the list, as in a bullet journal. A muted dash starts each item; a honey ★ replaces it on pinned items. Each mark covers the dot it sits on, and the dots and dashes run through the middle of the lowercase letters (both from Mattan's reviews).
- **Serif: Charter** (built into iPhone and Mac; no font files). Labels use the system sans.
- **Amber: Honey** (`#e2a651`). Page `#1c1814`, text `#ebe1d2`, muted `#a39582`, dots `#4a3e33`.
- **No categories in the UI.** The API's optional `category` field stays but the UI never sets it, so the sheet's fallback is one list.
- **Top of the page: today's date,** like a planner page (e.g. "Sunday, October 11").
- **Spacing:** one blank dot row between items, so every item has a finger-sized tap area.
- **Placeholder:** "Worth remembering…". **Empty page:** "A clean page.", starting in line with the date (Mattan, 2026-10-12; it used to line up with item text instead).
- **Laptop:** a phone-width page centered in the window, with plain darker space (`#13100d`) around it.
- **Editing:** tap an item to edit its text in place. Return or tapping elsewhere saves; Esc cancels. No Save button. On a laptop, the quiet words "Pin" (or "Unpin") and "Archive" appear under it.
- **Swipes (phone, today's page):** left archives, right pins or unpins. Nothing is revealed; the item follows the finger. _(How far it has to go, and what it shows: see 2026-10-12 below.)_
- **Undo lines:** "Archived", "Restored" or "Deleted" with "Undo", just above the add field, for about 5 seconds. A delete is only sent once its line goes away.
- **Archive view:** tap the date to flip to the archive (the heading becomes "Archived"); tap it again to come back. The add field is hidden there. An empty archive says "Nothing archived yet." On the phone, swipe left restores and swipe right deletes, with no confirmation. On a laptop, tapping an archived item shows "Restore" and "Delete".
- **Home-screen icon:** a dot grid with one dot marked in honey (`apps/web/public/icon.svg`, plus PNGs rendered from it).

## Decided (2026-10-12)
- **Sign-in screen** (the app has its own password instead of Cloudflare Access; Mattan chose "password at the bottom"). Signed out, the page looks like today's page with nothing on it: the date, the empty dot grid, and a password field where the add field is, with the same ↵ arrow. Placeholder "Password". Return or the arrow signs in. A phone stays signed in for a year. There's no sign-out button.
- Details settled while building it (open to change):
  - The arrow is muted until there's a password, like the add arrow.
  - A wrong password says "Wrong password." above the field and clears it, like a lock screen.
  - Signed out, the date doesn't flip to the archive.
  - If a session ends while the app is open, the next action's line says what failed ("Couldn't save. Sign in.") and the password field comes back. Text in the add field is kept.
  - A password manager's fill keeps the page's colours.

## Decided (2026-10-12): swipes, motion and the keyboard
Mattan asked for as little motion as possible, swipes that work "properly and seamlessly", and a keyboard that only covers what it has to. Researched (sources in `docs/DECISIONS.md`); Mattan chose the three options marked (chosen).
- **The keyboard covers the bottom of the page.** The date and the items stay exactly where they are; only the add field moves, riding up on the keyboard at its pace, and back down with it. Editing an item low on the page scrolls the list just enough to keep it above the add field. The page itself never scrolls; the list (with the date at its top) scrolls inside it.
- **When a swipe acts:** a quick flick acts even if it's short (about 0.4 px/ms, at least 32 px), and a slow drag acts once it's past 40% of the item's width. Letting go while heading back toward the start always cancels. (This replaces "past halfway".)
- **The cue (chosen):** once letting go would act, the item's own mark shows it. A swipe right turns the dash into a honey ★ (or a ★ back into a dash), and a swipe left, or any swipe that takes the item off the page, dims the whole item. It stays on until the item is back under 34%, so it doesn't flicker. Nothing appears behind the item.
- **Letting go without acting:** the item springs back without any bounce, keeping the finger's speed if it was already heading back. It can be caught again mid-way.
- **Leaving:** the item carries on off the page at the finger's speed (at most 0.2 s).
- **Closing the gap (chosen):** the items below glide up in about 0.2 s. Undo makes room the same way.
- **Pinning (chosen):** the item slides from where the finger left it to its place at the top in about 0.25 s, while the others shift down a row. Unpinning moves it back down the same way. The laptop's Pin word does the same.
- **Reduce Motion** on the phone turns all of this off: items still follow the finger, but everything else happens at once.
- Touches that start within 20 px of the screen's sides are left to iOS, and a finger resting on an item never starts a text selection.
- **Adding is instant:** a new item shows the moment Return (or the arrow) is pressed, and the field empties for the next one. If the server refuses it, it goes away again, its words come back to the field, and the line above says why. For that moment it can't be tapped or swiped.
- **The bar above the keyboard** (˄ ˅ ✓) is iOS's own and stays: on iPhone, WebKit adds it to every text field, and only a native app can turn it off (`docs/DECISIONS.md`).

## Never
Gradients, glassmorphism, glow, heavy shadows, card grids, emoji as icons, pill-badge clutter, purple/blue "AI" palettes, stock icon sets everywhere, bouncy animations, middle-dot meta strings ("A · B").

## Still to ask Mattan
Nothing open. Ask before any new visual or interaction choice.
