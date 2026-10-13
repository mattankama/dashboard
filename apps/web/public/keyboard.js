// @ts-check
// On iPhone the keyboard covers the page instead of resizing it, and Safari slides
// the whole page up to show the field being typed in. Here nothing moves but the
// add field: the page ends where the keyboard starts, so the field rides up on the
// keyboard while the date and the items stay where they were.
//
// No browser feature does this on iPhone yet (no `interactive-widget`, no
// VirtualKeyboard API in Safari), so it takes two steps (docs/DECISIONS.md):
// 1. Fields are focused "in place": for the moment of focus() the field is moved
//    out of sight, so Safari finds nothing to scroll to, then it's put straight
//    back. This is what Base UI does (confirmed on iOS 26 and 27).
// 2. The page's height follows the space above the keyboard (visualViewport).

const root = document.documentElement;
const viewport = window.visualViewport;
/** Less than this (px) covered is a toolbar or rounding, not a keyboard. */
const KEYBOARD = 80;

/** Whether the keyboard is up (a field can be focused without it). */
function keyboardShown() {
  return viewport !== undefined && viewport !== null && window.innerHeight - viewport.height > KEYBOARD;
}

/**
 * @param {Element | null} el
 * @returns {el is HTMLTextAreaElement | HTMLInputElement}
 */
function isField(el) {
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== "hidden");
}

/**
 * Focuses a field without Safari scrolling the page to it. Safari reads the
 * field's position during focus(), so it's hidden away for just that call.
 * @param {HTMLTextAreaElement | HTMLInputElement} field
 */
export function focusInPlace(field) {
  const style = field.style;
  const saved = [style.opacity, style.transform, style.transition];
  style.transition = "none";
  style.opacity = "0";
  style.transform = "translateY(-2000px)";
  try {
    field.focus({ preventScroll: true });
  } finally {
    [style.opacity, style.transform, style.transition] = saved;
  }
}

/**
 * A tap on this field focuses it in place, with the caret at the end. Taps on a
 * field that's already focused, with the keyboard up (to move the caret, or
 * select), are left alone. A field can also be focused with no keyboard (iOS
 * hid it, or a script focused it): a tap then re-focuses it in place, since
 * Safari's own focus would slide the page up.
 * @param {HTMLTextAreaElement | HTMLInputElement} field
 */
export function focusOnTap(field) {
  /** @type {HTMLElement} */
  const target = field;
  let x = 0;
  let y = 0;
  target.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.touches[0];
      if (touch) ({ clientX: x, clientY: y } = touch);
    },
    { passive: true },
  );
  target.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    if (!touch || Math.hypot(touch.clientX - x, touch.clientY - y) > 10) return;
    if (document.activeElement === field && keyboardShown()) return;
    event.preventDefault(); // Safari's own focus would scroll the page
    if (document.activeElement === field) field.blur(); // focus() alone wouldn't bring the keyboard back
    focusInPlace(field); // still inside the tap, so the keyboard opens
    field.setSelectionRange(field.value.length, field.value.length);
  });
}

/**
 * Keeps the page sized to the space above the keyboard, and the field being
 * typed in (inside `scroller`) in view.
 * @param {HTMLElement} page  its height follows the keyboard (CSS transition)
 * @param {HTMLElement} scroller
 */
export function followKeyboard(page, scroller) {
  if (!viewport) return;

  function sync() {
    if (!viewport || viewport.scale > 1.01) return; // pinch-zoomed: leave it alone
    // If Safari scrolled the page anyway, put it back (the page itself never scrolls).
    if (window.scrollY !== 0 || viewport.offsetTop !== 0) window.scrollTo(0, 0);
    const open = isField(document.activeElement) && keyboardShown();
    const height = open ? `${Math.round(viewport.height)}px` : "";
    if (root.style.getPropertyValue("--app-height") === height) return;
    root.classList.toggle("keyboard", open);
    if (open) root.style.setProperty("--app-height", height);
    else root.style.removeProperty("--app-height");
    if (open && getComputedStyle(page).transitionDuration === "0s") reveal();
  }

  /** Scrolls the list just enough that a field being typed in it isn't hidden. */
  function reveal() {
    const field = document.activeElement;
    if (!isField(field) || !scroller.contains(field)) return;
    const box = (field.closest(".item") ?? field).getBoundingClientRect();
    const bottom = scroller.getBoundingClientRect().bottom;
    const row = Number.parseFloat(getComputedStyle(root).fontSize) * 1.5; // one dot row
    if (box.bottom + row > bottom) scroller.scrollBy({ top: box.bottom + row - bottom, behavior: "smooth" });
  }

  viewport.addEventListener("resize", sync);
  viewport.addEventListener("scroll", sync);
  window.addEventListener("scroll", sync);
  document.addEventListener("visibilitychange", sync);
  document.addEventListener("focusin", sync);
  // Closing starts with the blur, not when Safari reports it (after the keyboard has
  // gone). Wait a frame: focus may be moving to another field.
  document.addEventListener("focusout", () => requestAnimationFrame(sync));
  page.addEventListener("transitionend", (event) => {
    if (event.target === page && event.propertyName === "height" && root.classList.contains("keyboard")) reveal();
  });
  // An item being edited grows as it's typed in.
  scroller.addEventListener("input", reveal);
}
