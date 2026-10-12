// @ts-check
import { compareItems, formatDay, isoDay } from "./lib.js";

/** @typedef {import("./lib.js").Item} Item */

/**
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function byId(id) {
  return /** @type {T} */ (document.getElementById(id));
}

const today = /** @type {HTMLTimeElement} */ (byId("today"));
const list = /** @type {HTMLUListElement} */ (byId("items"));
const empty = byId("empty");
const notice = byId("notice");
const form = /** @type {HTMLFormElement} */ (byId("add"));
const field = /** @type {HTMLTextAreaElement} */ (byId("new-item"));
const save = /** @type {HTMLButtonElement} */ (byId("save"));

/** @type {Item[]} */
let items = [];
let loaded = false;
let saving = false;

/** An error the API answered with, as opposed to a network failure. */
class ApiError extends Error {}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 * @returns {Promise<any>}
 */
async function api(path, init) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`);
  return body;
}

/** @param {unknown} err */
function describe(err) {
  if (err instanceof ApiError) return `${err.message.charAt(0).toUpperCase()}${err.message.slice(1)}.`;
  return "Check your connection and try again.";
}

/**
 * @param {string} message
 * @param {() => void} [retry]
 */
function showNotice(message, retry) {
  notice.replaceChildren(message);
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "retry";
    button.textContent = "Try again";
    button.addEventListener("click", retry);
    notice.append(" ", button);
  }
  notice.hidden = false;
}

function hideNotice() {
  notice.hidden = true;
  notice.replaceChildren();
}

function renderDate() {
  const now = new Date();
  today.textContent = formatDay(now, navigator.language);
  today.dateTime = isoDay(now);
}

/** @param {Item} item */
function renderItem(item) {
  const li = document.createElement("li");
  li.className = item.pinned ? "item pinned" : "item";
  li.dataset.id = item.id;

  const mark = document.createElement("span");
  mark.className = "mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = item.pinned ? "★" : "–";

  // Item text is user data: textContent only, never innerHTML.
  const text = document.createElement("span");
  text.className = "text";
  text.textContent = item.text;

  li.append(mark);
  if (item.pinned) {
    const label = document.createElement("span");
    label.className = "visually-hidden";
    label.textContent = "Pinned: ";
    li.append(label);
  }
  li.append(text);
  return li;
}

function render() {
  list.replaceChildren(...items.map(renderItem));
  empty.hidden = !loaded || items.length > 0;
}

/** Enables the save arrow only when there's text, and grows the field with it. */
function syncField() {
  save.disabled = saving || field.value.trim() === "";
  field.style.height = "auto";
  field.style.height = `${field.scrollHeight}px`;
}

async function loadItems() {
  hideNotice();
  try {
    const body = await api("/api/items");
    items = body.items;
    loaded = true;
    render();
  } catch (err) {
    showNotice(`Couldn't load your items. ${describe(err)}`, loadItems);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = field.value;
  if (saving || text.trim() === "") return;

  saving = true;
  syncField();
  try {
    const { item } = await api("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    items = [...items, item].sort(compareItems);
    render();
    list.querySelector(`[data-id="${item.id}"]`)?.scrollIntoView({ block: "nearest" });
    hideNotice();
    // Keep anything typed while the request was in flight.
    if (field.value === text) field.value = "";
  } catch (err) {
    showNotice(`Couldn't save. ${describe(err)}`);
  } finally {
    saving = false;
    syncField();
    field.focus();
  }
});

// Return saves; Shift+Return starts a new line.
field.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});
field.addEventListener("input", syncField);

// Keep the date right when the app comes back after midnight.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderDate();
});

renderDate();
syncField();
// Phones only show the keyboard after a tap, so focus on load only with a mouse.
if (matchMedia("(hover: hover) and (pointer: fine)").matches) field.focus();
loadItems();
