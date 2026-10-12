// @ts-check
import { compareItems, editPatch, formatDay, isoDay } from "./lib.js";
import { enableSwipe } from "./swipe.js";

/** @typedef {import("./lib.js").Item} Item */
/** @typedef {{ text?: string, pinned?: boolean, archived?: boolean }} Patch */

const UNDO_MS = 5000;
// Desktop-style input: focus can safely move to the next thing without popping a phone keyboard.
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

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
const undoLine = byId("undo");
const undoButton = /** @type {HTMLButtonElement} */ (byId("undo-button"));
const notice = byId("notice");
const form = /** @type {HTMLFormElement} */ (byId("add"));
const field = /** @type {HTMLTextAreaElement} */ (byId("new-item"));
const save = /** @type {HTMLButtonElement} */ (byId("save"));

/** @type {Item[]} */
let items = [];
let loaded = false;
let saving = false;
/** The item open for editing, and its unsaved text. */
/** @type {string | null} */
let editingId = null;
let draft = "";
/** The last archived item, while its undo line shows. */
/** @type {{ item: Item, request: Promise<boolean>, timer: number } | null} */
let undo = null;
/** True while the list is being rebuilt, so focus changes it causes are ignored. */
let rendering = false;

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

/**
 * @param {string} id
 * @param {Patch} patch
 * @returns {Promise<{ item: Item }>}
 */
function patchItem(id, patch) {
  return api(`/api/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
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
    button.className = "word";
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

// ---- The list ----

/** @param {Item} item */
function renderItem(item) {
  const li = document.createElement("li");
  li.className = item.pinned ? "item pinned" : "item";
  li.dataset.id = item.id;

  // The dash or star itself is drawn by CSS (.mark::after) so it can sit on its dot.
  const mark = document.createElement("span");
  mark.className = "mark";
  mark.setAttribute("aria-hidden", "true");
  li.append(mark);

  if (item.id === editingId) {
    li.classList.add("editing");
    li.append(renderEditor(item));
  } else {
    li.append(renderOpenButton(item));
  }
  return li;
}

/** @param {Item} item */
function renderOpenButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "open";
  if (item.pinned) {
    const label = document.createElement("span");
    label.className = "visually-hidden";
    label.textContent = "Pinned: ";
    button.append(label);
  }
  // Item text is user data: textContent only, never innerHTML.
  const text = document.createElement("span");
  text.className = "text";
  text.textContent = item.text;
  button.append(text);
  return button;
}

/** @param {Item} item */
function renderEditor(item) {
  const editor = document.createElement("div");
  editor.className = "editor";

  const area = document.createElement("textarea");
  area.className = "edit-text";
  area.rows = 1;
  area.value = draft;
  area.setAttribute("aria-label", "Edit item");

  const words = document.createElement("div");
  words.className = "edit-words";
  words.append(word(item.pinned ? "Unpin" : "Pin", "pin"), word("Archive", "archive"));

  editor.append(area, words);
  return editor;
}

/**
 * @param {string} label
 * @param {string} action
 */
function word(label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "word";
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function editArea() {
  return /** @type {HTMLTextAreaElement | null} */ (list.querySelector(".edit-text"));
}

/** @param {HTMLTextAreaElement} area */
function sizeToContent(area) {
  area.style.height = "auto";
  area.style.height = `${area.scrollHeight}px`;
}

/** Rebuilds the list, keeping the editor's focus and caret if it had them. */
function render() {
  const active = editArea();
  const selection = active && document.activeElement === active ? [active.selectionStart, active.selectionEnd] : null;

  rendering = true;
  list.replaceChildren(...items.map(renderItem));
  rendering = false;
  empty.hidden = !loaded || items.length > 0;

  const area = editArea();
  if (area) {
    sizeToContent(area);
    if (selection) {
      area.focus();
      area.setSelectionRange(selection[0], selection[1]);
    }
  }
}

/**
 * Redraws one item in place. Used when its position can't change, so the
 * buttons of other items stay put while someone is tapping them.
 * @param {string} id
 */
function renderRow(id) {
  const li = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
  const item = items.find((i) => i.id === id);
  if (!li || !item) return;
  rendering = true;
  li.replaceWith(renderItem(item));
  rendering = false;
}

/** @param {string} id */
function focusItem(id) {
  /** @type {HTMLElement | null} */ (list.querySelector(`[data-id="${CSS.escape(id)}"] .open`))?.focus();
}

/** @param {Item} item */
function putItem(item) {
  items = [...items.filter((i) => i.id !== item.id), item].sort(compareItems);
}

// ---- Editing ----

/** @param {string} id */
function openEditor(id) {
  if (editingId !== null && editingId !== id) commitEdit();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  editingId = id;
  draft = item.text;
  render();
  const area = editArea();
  if (area) {
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }
}

/** Closes the editor without saving. */
function cancelEdit() {
  const id = editingId;
  editingId = null;
  draft = "";
  if (id !== null) {
    renderRow(id);
    focusItem(id);
  }
}

/**
 * Saves the open editor. The change shows at once; if the server refuses it,
 * the item goes back and the editor reopens with the unsaved words.
 * @param {{ pinned?: boolean, archived?: boolean }} [extra]  from the Pin and Archive words
 * @param {boolean} [refocus]  put keyboard focus back on the item
 */
function commitEdit(extra = {}, refocus = false) {
  const original = items.find((i) => i.id === editingId);
  const text = draft;
  editingId = null;
  draft = "";
  if (!original) return;

  const patch = editPatch(original, text, extra);
  if (patch === null) {
    renderRow(original.id);
    if (refocus) focusItem(original.id);
    return;
  }
  if (patch.archived) {
    archive(original, patch);
    return;
  }

  putItem({
    ...original,
    ...(patch.text === undefined ? {} : { text: patch.text.trim() }),
    ...(patch.pinned === undefined ? {} : { pinned: patch.pinned }),
  });
  if (patch.pinned === undefined) renderRow(original.id);
  else render();
  if (refocus) focusItem(original.id);

  patchItem(original.id, patch).then(
    ({ item }) => {
      putItem(item);
      hideNotice();
    },
    (err) => {
      putItem(original);
      if (editingId === null) {
        editingId = original.id;
        draft = text;
      }
      render();
      showNotice(`Couldn't save your edit. ${describe(err)}`);
    },
  );
}

// ---- Archiving and undo ----

/**
 * @param {Item} item
 * @param {Patch} [patch]  may also carry a text change made just before archiving
 */
function archive(item, patch = { archived: true }) {
  items = items.filter((i) => i.id !== item.id);
  render();

  const request = patchItem(item.id, patch).then(
    () => true,
    (err) => {
      if (undo?.item.id === item.id) hideUndo();
      putItem(item);
      render();
      showNotice(`Couldn't archive that item. ${describe(err)}`);
      return false;
    },
  );
  showUndo(item, request);
}

/**
 * @param {Item} item
 * @param {Promise<boolean>} request  resolves to whether the archive saved
 */
function showUndo(item, request) {
  hideUndo();
  undo = { item, request, timer: window.setTimeout(hideUndo, UNDO_MS) };
  undoLine.hidden = false;
}

function hideUndo() {
  if (undo) clearTimeout(undo.timer);
  undo = null;
  undoLine.hidden = true;
}

// Give people time to reach Undo: pause the countdown while it's hovered or focused.
function pauseUndo() {
  if (undo) clearTimeout(undo.timer);
}

function resumeUndo() {
  if (undo) undo.timer = window.setTimeout(hideUndo, UNDO_MS);
}

/** @param {boolean} [refocus]  put keyboard focus on the restored item */
async function undoArchive(refocus = false) {
  if (!undo) return;
  const { item, request } = undo;
  hideUndo();
  // Let the archive land first, so the two requests can't arrive out of order.
  if (!(await request)) return;
  try {
    const { item: restored } = await patchItem(item.id, { archived: false });
    putItem(restored);
    render();
    if (refocus) focusItem(restored.id);
    hideNotice();
  } catch (err) {
    showNotice(`Couldn't undo. ${describe(err)}`);
  }
}

// ---- Adding ----

/** Enables the save arrow only when there's text, and grows the field with it. */
function syncField() {
  save.disabled = saving || field.value.trim() === "";
  sizeToContent(field);
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
    putItem(item);
    render();
    list.querySelector(`[data-id="${CSS.escape(item.id)}"]`)?.scrollIntoView({ block: "nearest" });
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

// ---- List events ----

list.addEventListener("click", (event) => {
  const target = /** @type {Element} */ (event.target);
  const id = /** @type {HTMLElement | null} */ (target.closest(".item"))?.dataset.id;
  if (!id) return;

  const action = /** @type {HTMLElement | null} */ (target.closest(".word"))?.dataset.action;
  if (action === "pin") {
    const item = items.find((i) => i.id === id);
    // detail is 0 when a key, not a pointer, pressed the button.
    if (item) commitEdit({ pinned: !item.pinned }, event.detail === 0);
  } else if (action === "archive") {
    commitEdit({ archived: true });
    if (event.detail === 0) undoButton.focus();
  } else if (target.closest(".open")) {
    openEditor(id);
  }
});

// Keep the text focused while pressing Pin or Archive (iPhone buttons don't take focus).
list.addEventListener("pointerdown", (event) => {
  if (/** @type {Element} */ (event.target).closest(".word")) event.preventDefault();
});

list.addEventListener("input", (event) => {
  const area = /** @type {HTMLTextAreaElement} */ (event.target);
  if (!area.classList.contains("edit-text")) return;
  draft = area.value;
  sizeToContent(area);
});

list.addEventListener("keydown", (event) => {
  if (!(/** @type {Element} */ (event.target).classList.contains("edit-text"))) return;
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    commitEdit({}, finePointer.matches);
  } else if (event.key === "Escape") {
    event.preventDefault();
    cancelEdit();
  }
});

// Leaving the item (tapping elsewhere, tabbing away) saves it.
list.addEventListener("focusout", (event) => {
  if (rendering || editingId === null) return;
  const li = /** @type {Element} */ (event.target).closest(".editing");
  const next = /** @type {Node | null} */ (event.relatedTarget);
  if (li && !(next && li.contains(next))) commitEdit();
});

// On iPhone, tapping a blank spot doesn't blur the text field, so do it here.
document.addEventListener("pointerdown", (event) => {
  if (editingId !== null && !(/** @type {Element} */ (event.target).closest(".editing"))) editArea()?.blur();
});

enableSwipe(list, (id) => {
  const item = items.find((i) => i.id === id);
  if (item) archive(item);
});

undoButton.addEventListener("click", (event) => undoArchive(event.detail === 0));
undoLine.addEventListener("pointerenter", pauseUndo);
undoLine.addEventListener("pointerleave", resumeUndo);
undoLine.addEventListener("focusin", pauseUndo);
undoLine.addEventListener("focusout", resumeUndo);

// Keep the date right when the app comes back after midnight.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderDate();
});

renderDate();
syncField();
// Phones only show the keyboard after a tap, so focus on load only with a mouse.
if (finePointer.matches) field.focus();
loadItems();
