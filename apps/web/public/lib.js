// @ts-check
// Pure helpers for the UI. No DOM here, so they're unit-tested in test/lib.test.ts.

/**
 * @typedef {{ id: string, text: string, category: string | null, pinned: boolean,
 *   createdAt: string, updatedAt: string, archivedAt: string | null }} Item
 */

/**
 * Same order as the API's active list: pinned first, then newest first.
 * @param {Item} a
 * @param {Item} b
 */
export function compareItems(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * The page heading, like the top of a planner page: "Sunday, October 11".
 * @param {Date} date
 * @param {string} [locale]
 */
export function formatDay(date, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

/**
 * The local calendar date as YYYY-MM-DD, for <time datetime>.
 * @param {Date} date
 */
export function isoDay(date) {
  /** @param {number} n */
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * What saving an edit should send: the text only if it really changed (the
 * server trims it), plus any pin or archive change. Null means nothing to send.
 * @param {Item} item
 * @param {string} draft
 * @param {{ pinned?: boolean, archived?: boolean }} [extra]
 * @returns {{ text?: string, pinned?: boolean, archived?: boolean } | null}
 */
export function editPatch(item, draft, extra = {}) {
  /** @type {{ text?: string, pinned?: boolean, archived?: boolean }} */
  const patch = { ...extra };
  if (draft.trim() !== item.text) patch.text = draft;
  return Object.keys(patch).length === 0 ? null : patch;
}

/**
 * A swipe acts once the item has been dragged at least halfway, either way.
 * @param {number} dx  horizontal drag distance in px (negative = left)
 * @param {number} width  the item's width in px
 * @returns {"left" | "right" | "back"}
 */
export function swipeOutcome(dx, width) {
  if (dx <= -width / 2) return "left";
  if (dx >= width / 2) return "right";
  return "back";
}
