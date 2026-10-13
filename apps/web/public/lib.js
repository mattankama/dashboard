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
 * Same order as the API's archived list: most recently archived first.
 * @param {Item} a
 * @param {Item} b
 */
export function compareArchived(a, b) {
  return (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "");
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
 * How far and how fast a swipe has to go to act (docs/UI.md). Sources for the
 * numbers are in docs/DECISIONS.md.
 */
export const SWIPE = {
  /** Past this share of the item's width, letting go acts (the item shows it)... */
  distance: 0.4,
  /** ...until it's dragged back under this share, so the cue doesn't flicker. */
  disarm: 0.34,
  /** A flick acts at this speed (px/ms) in its direction... */
  flickSpeed: 0.4,
  /** ...once it has gone this far (px). */
  flickMin: 32,
  /** The speed is measured over this many ms before letting go... */
  window: 100,
  /** ...and is zero if the finger stopped for this long first. */
  stopped: 40,
};

/**
 * Whether letting go now would act, going by distance alone.
 * @param {number} dx  horizontal drag distance in px (negative = left)
 * @param {number} width  the item's width in px
 * @param {boolean} wasArmed  whether it was armed a moment ago
 */
export function armed(dx, width, wasArmed) {
  return Math.abs(dx) >= (wasArmed ? SWIPE.disarm : SWIPE.distance) * width;
}

/**
 * What letting go of a swiped item does. It acts when armed (dragged far enough)
 * or flicked fast enough; a finger heading back as it lets go always cancels.
 * @param {number} dx  horizontal drag distance in px (negative = left)
 * @param {number} speed  the finger's speed as it let go, px/ms (negative = left)
 * @param {boolean} isArmed  see `armed`
 * @returns {"left" | "right" | "back"}
 */
export function swipeOutcome(dx, speed, isArmed) {
  if (dx === 0) return "back";
  const way = dx < 0 ? "left" : "right";
  const onward = Math.sign(dx) * speed; // negative when heading back
  if (onward <= -SWIPE.flickSpeed) return "back";
  if (isArmed) return way;
  if (onward >= SWIPE.flickSpeed && Math.abs(dx) >= SWIPE.flickMin) return way;
  return "back";
}

/**
 * The slide back to rest as a critically damped spring (no bounce, like iOS),
 * written as a CSS `linear()` easing. A finger already heading back carries its
 * speed into the slide, capped so the item can never overshoot.
 * @param {number} x0  where the item is, px from rest
 * @param {number} v0  the finger's speed as it let go, px/ms (same sign convention)
 * @returns {{ easing: string, duration: number }}
 */
export function springBack(x0, v0) {
  const omega = (2 * Math.PI) / 300; // a 300ms spring (Apple's default is 500ms)
  if (Math.abs(x0) < 0.5) return { easing: "linear", duration: 0 };
  // Speed toward rest as a share of the distance per ms (<= 0), capped at omega.
  const u = Math.max(-omega, Math.min(0, v0 / x0));
  /** @param {number} t */
  const left = (t) => (1 + (omega + u) * t) * Math.exp(-omega * t); // share of x0 still to go
  let duration = 1;
  while (duration < 500 && Math.abs(x0) * left(duration) >= 0.5) duration++;
  const steps = 20;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const p = i === steps ? 1 : 1 - left((duration * i) / steps);
    points.push(Number(p.toFixed(4)));
  }
  return { easing: `linear(${points.join(", ")})`, duration };
}

/**
 * The finger's horizontal speed as it let go, in px/ms, from its last moves.
 * @param {{ x: number, t: number }[]} moves  oldest first
 * @param {number} now  when it let go (same clock as `t`)
 */
export function releaseSpeed(moves, now) {
  const recent = moves.filter((m) => now - m.t <= SWIPE.window);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || last === first || now - last.t > SWIPE.stopped) return 0;
  return (last.x - first.x) / (last.t - first.t);
}
