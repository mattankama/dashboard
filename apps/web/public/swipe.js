// @ts-check
// Swipe an item left or right to act on it, and the motion when items move. Touch
// and pen only: a mouse drag does nothing, and on a laptop the same actions are
// words that appear on tap (docs/UI.md).
//
// Touch Events, not Pointer Events: on iPhone a slow sideways drag can turn into a
// scroll halfway (WebKit bugs 203335, 232545), and only a touchmove's
// preventDefault() stops that. Choices and sources: docs/DECISIONS.md.
import { SWIPE, armed, releaseSpeed, springBack, swipeOutcome } from "./lib.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const springs = CSS.supports("transition-timing-function", "linear(0, 1)");
/** How far (px) a finger moves before the touch counts as a swipe or a scroll. */
const SLOP = 10;
/** Sideways means more than 1.2 times as far across as down (within about 40°). */
const ACROSS = 1.2;
/** Touches that start this close (px) to the screen's sides belong to iOS. */
const EDGE = 20;
/** Items making room or moving to their new place (docs/UI.md). */
const MOVE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

/** @typedef {"pin" | "unpin" | "dim"} Cue */
/**
 * @typedef {{ leaves: boolean, cue: Cue, run: (id: string) => void }} SwipeAction
 *   `leaves`: the item slides off the page before the action runs. `cue`: how the
 *   item shows that letting go will act.
 */

/**
 * @param {HTMLElement} list
 * @param {(direction: "left" | "right", id: string) => SwipeAction | null} actionFor
 *   What a swipe that way does to that item right now; null means it doesn't move that way.
 * @param {() => void} onIdle  runs when nothing is being swiped or sliding off
 * @returns {{ busy: () => boolean }}  busy: the list mustn't be rebuilt now, or the
 *   item under the finger would be lost (touches stay with the element they began on)
 */
export function enableSwipe(list, actionFor, onIdle) {
  /**
   * The touch in progress. `startX` is where the finger would be with the item at rest.
   * @type {{ li: HTMLElement, touch: number, startX: number, startY: number, width: number,
   *   dx: number, swiping: boolean, armed: boolean, cue: Cue | null, moves: { x: number, t: number }[] } | null}
   */
  let drag = null;
  let leaving = 0;

  list.addEventListener(
    "touchstart",
    (event) => {
      if (drag) {
        cancel(); // a second finger: let go of the swipe
        return;
      }
      const touch = event.changedTouches[0];
      if (!touch || event.touches.length > 1) return;
      if (touch.clientX < EDGE || touch.clientX > window.innerWidth - EDGE) return;
      const li = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest(".item"));
      if (!li || li.classList.contains("editing") || li.classList.contains("leaving")) return;
      // An item still springing back is caught where it is, so it never jumps.
      const from = catchItem(li);
      drag = {
        li,
        touch: touch.identifier,
        startX: touch.clientX - from,
        startY: touch.clientY,
        width: li.offsetWidth,
        dx: from,
        swiping: from !== 0,
        armed: false,
        cue: null,
        moves: [{ x: touch.clientX, t: event.timeStamp }],
      };
    },
    { passive: true },
  );

  list.addEventListener(
    "touchmove",
    (event) => {
      if (!drag) return;
      const touch = find(event.changedTouches, drag.touch);
      if (!touch) return;
      if (!drag.swiping) {
        const dx = touch.clientX - drag.startX;
        const dy = touch.clientY - drag.startY;
        if (!event.cancelable) {
          cancel(); // iOS is already scrolling
          return;
        }
        if (Math.hypot(dx, dy) < SLOP) return;
        if (Math.abs(dx) <= ACROSS * Math.abs(dy)) {
          cancel(); // a scroll: the page has it
          return;
        }
        drag.swiping = true;
        drag.startX += Math.sign(dx) * SLOP; // start following from here, without a jump
      }
      if (!event.cancelable) {
        cancel();
        return;
      }
      event.preventDefault(); // this touch is a swipe now, never a scroll
      const x = touch.clientX - drag.startX;
      const action = actionFor(x < 0 ? "left" : "right", drag.li.dataset.id ?? "");
      drag.dx = action ? x : 0;
      drag.moves.push({ x: touch.clientX, t: event.timeStamp });
      if (drag.moves.length > 32) drag.moves.splice(0, drag.moves.length - 32);
      drag.li.style.translate = `${drag.dx}px 0`;
      drag.armed = action !== null && armed(drag.dx, drag.width, drag.armed);
      const cue = drag.armed && action ? action.cue : null;
      if (cue !== drag.cue) {
        drag.cue = cue;
        showCue(drag.li, cue);
      }
    },
    { passive: false },
  );

  list.addEventListener(
    "touchend",
    (event) => {
      if (!drag || !find(event.changedTouches, drag.touch)) return;
      const { li, dx, swiping, moves } = drag;
      const wasArmed = drag.armed;
      drag = null;
      if (!swiping) {
        onIdle();
        return;
      }
      event.preventDefault(); // a swipe is not a tap: no click follows
      const speed = releaseSpeed(moves, event.timeStamp);
      const outcome = swipeOutcome(dx, speed, wasArmed);
      const id = li.dataset.id ?? "";
      const action = outcome === "back" ? null : actionFor(outcome, id);
      if (action?.leaves) {
        leaving++;
        li.classList.add("leaving");
        flyOff(li, dx, outcome === "left" ? -offPage(li, "left") : offPage(li, "right"), speed, () => {
          leaving--;
          action.run(id);
          onIdle();
        });
      } else if (action) {
        // The list is rebuilt with the item in its new place; moveSmoothly carries it
        // there from where the finger left it.
        action.run(id);
        if (li.isConnected) springHome(li, dx, speed);
        onIdle();
      } else {
        showCue(li, null);
        springHome(li, dx, speed);
        onIdle();
      }
    },
    { passive: false },
  );

  list.addEventListener("touchcancel", (event) => {
    if (drag && find(event.changedTouches, drag.touch)) cancel();
  });

  /** The swipe is off (a scroll, a second finger, iOS took the touch): back to rest. */
  function cancel() {
    if (!drag) return;
    const { li, dx } = drag;
    drag = null;
    showCue(li, null);
    springHome(li, dx, 0);
    onIdle();
  }

  return { busy: () => drag !== null || leaving > 0 };
}

/**
 * @param {TouchList} touches
 * @param {number} id
 */
function find(touches, id) {
  for (const touch of touches) if (touch.identifier === id) return touch;
  return null;
}

/**
 * Shows on the item what letting go will do: a pin's ★ (or its dash, when
 * unpinning), or the whole item dimmed for actions that take it off the page.
 * @param {HTMLElement} li
 * @param {Cue | null} cue  null clears it
 */
function showCue(li, cue) {
  li.classList.remove("armed-pin", "armed-unpin", "armed-dim");
  if (cue) li.classList.add(`armed-${cue}`);
}

/**
 * The item's sideways shift right now (px).
 * @param {HTMLElement} li
 */
function currentShift(li) {
  return Number.parseFloat(getComputedStyle(li).translate) || 0;
}

/**
 * Stops an item that's springing back, leaving it where it is. Returns its shift.
 * @param {HTMLElement} li
 */
function catchItem(li) {
  const shift = currentShift(li);
  for (const animation of li.getAnimations()) if (animation.id === "spring") animation.cancel();
  li.style.translate = shift === 0 ? "" : `${shift}px 0`;
  return shift;
}

/**
 * How far an item has to move to be fully off the page that way.
 * @param {HTMLElement} li
 * @param {"left" | "right"} way
 */
function offPage(li, way) {
  const page = /** @type {HTMLElement} */ (li.closest(".sheet") ?? document.body).getBoundingClientRect();
  const box = li.getBoundingClientRect();
  const shift = currentShift(li); // measure from where the item sits at rest
  return way === "left" ? box.right - shift - page.left : page.right - (box.left - shift);
}

/**
 * Springs an item back to rest, carrying on with the finger's speed if it was
 * already heading back. It never overshoots.
 * @param {HTMLElement} li
 * @param {number} from  px from rest
 * @param {number} speed  px/ms as the finger let go
 */
function springHome(li, from, speed) {
  li.style.translate = "";
  if (reduceMotion.matches || from === 0) return;
  const { easing, duration } = springs ? springBack(from, speed) : { easing: "cubic-bezier(0.25, 1, 0.5, 1)", duration: 300 };
  if (duration === 0) return;
  li.animate([{ translate: `${from}px 0` }, { translate: "0 0" }], { id: "spring", duration, easing });
}

/**
 * Slides an item off the page at the finger's speed (at least), then calls `done`.
 * @param {HTMLElement} li
 * @param {number} from  px from rest
 * @param {number} to  px from rest, off the page
 * @param {number} speed  px/ms as the finger let go
 * @param {() => void} done
 */
function flyOff(li, from, to, speed, done) {
  li.style.translate = `${to}px 0`;
  if (reduceMotion.matches) {
    done();
    return;
  }
  const duration = Math.min(200, Math.max(100, Math.abs(to - from) / Math.max(Math.abs(speed), 0.01)));
  li.animate([{ translate: `${from}px 0` }, { translate: `${to}px 0` }], { duration, easing: "linear" }).finished.then(done, done);
}

/**
 * Makes a change to the list, then slides each item that moved from where it was
 * to its new place, so the items close a gap, or make room, instead of jumping.
 * Items that are new appear in place; items that left are gone already.
 * @param {HTMLElement} list
 * @param {number} duration  ms
 * @param {() => void} change
 */
export function moveSmoothly(list, duration, change) {
  if (reduceMotion.matches) {
    change();
    return;
  }
  /** @type {Map<string, DOMRect>} */
  const before = new Map();
  for (const li of /** @type {HTMLCollectionOf<HTMLElement>} */ (list.children)) {
    if (li.dataset.id) before.set(li.dataset.id, li.getBoundingClientRect());
  }
  change();
  for (const li of /** @type {HTMLCollectionOf<HTMLElement>} */ (list.children)) {
    const was = li.dataset.id ? before.get(li.dataset.id) : undefined;
    if (!was) continue;
    const now = li.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    li.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration, easing: MOVE_EASING });
  }
}
