// @ts-check
// Swipe an item left or right to act on it. Touch and pen only: a mouse drag does
// nothing, and on a laptop the same actions are words that appear on tap (docs/UI.md).
import { swipeOutcome } from "./lib.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** @typedef {{ leaves: boolean, run: (id: string) => void }} SwipeAction */

/**
 * @param {HTMLElement} list
 * @param {(direction: "left" | "right") => SwipeAction | null} actionFor
 *   What a swipe that way does right now; null means items don't move that way.
 *   An action that `leaves` slides the item off the page before it runs.
 */
export function enableSwipe(list, actionFor) {
  /** @type {{ li: HTMLElement, pointer: number, x: number, y: number, dx: number, swiping: boolean } | null} */
  let drag = null;
  // A swipe ends with a click on the item; it mustn't also open the editor.
  let ignoreClicksUntil = 0;

  list.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || drag) return;
    const li = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest(".item"));
    if (!li || li.classList.contains("editing")) return;
    drag = { li, pointer: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, swiping: false };
  });

  list.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.swiping) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag = null; // a vertical scroll, not a swipe
        return;
      }
      if (Math.abs(dx) < 10) return;
      drag.swiping = true;
      drag.li.setPointerCapture(drag.pointer);
      drag.li.style.transition = "none";
    }
    drag.dx = actionFor(dx < 0 ? "left" : "right") ? dx : 0;
    drag.li.style.translate = `${drag.dx}px 0`;
  });

  list.addEventListener("pointerup", (event) => finish(event, false));
  list.addEventListener("pointercancel", (event) => finish(event, true));
  list.addEventListener(
    "click",
    (event) => {
      if (performance.now() < ignoreClicksUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  /**
   * @param {PointerEvent} event
   * @param {boolean} cancelled
   */
  function finish(event, cancelled) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const { li, dx, swiping } = drag;
    drag = null;
    if (!swiping) return;

    ignoreClicksUntil = performance.now() + 400;
    const outcome = cancelled ? "back" : swipeOutcome(dx, li.offsetWidth);
    const action = outcome === "back" ? null : actionFor(outcome);
    const id = li.dataset.id ?? "";
    if (action?.leaves) {
      slide(li, outcome === "left" ? "-100%" : "100%", () => action.run(id));
      return;
    }
    slide(li, "0px", () => {
      li.style.translate = "";
      li.style.transition = "";
      action?.run(id);
    });
  }
}

/**
 * @param {HTMLElement} li
 * @param {string} to
 * @param {() => void} done
 */
function slide(li, to, done) {
  let finished = false;
  const finishOnce = () => {
    if (finished) return;
    finished = true;
    done();
  };
  if (reduceMotion.matches) {
    li.style.translate = `${to} 0`;
    finishOnce();
    return;
  }
  li.style.transition = "translate 180ms ease-out";
  li.style.translate = `${to} 0`;
  li.addEventListener("transitionend", finishOnce, { once: true });
  setTimeout(finishOnce, 300); // in case no transition runs
}
