// @ts-check
import { compareArchived, compareItems, editPatch, formatDay, isoDay } from "./lib.js";
import { enableSwipe } from "./swipe.js";

/** @typedef {import("./lib.js").Item} Item */
/** @typedef {{ text?: string, pinned?: boolean, archived?: boolean }} Patch */
/** @typedef {"active" | "archived"} View */

const UNDO_MS = 5000;
// A mouse or trackpad: no swiping, so actions are words; focus can move without popping a keyboard.
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

/**
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function byId(id) {
  return /** @type {T} */ (document.getElementById(id));
}

const page = /** @type {HTMLElement} */ (document.querySelector(".page"));
const flip = /** @type {HTMLButtonElement} */ (byId("flip"));
const flipLabel = byId("flip-label");
const today = /** @type {HTMLTimeElement} */ (byId("today"));
const list = /** @type {HTMLUListElement} */ (byId("items"));
const empty = byId("empty");
const undoLine = byId("undo");
const undoLabel = byId("undo-label");
const undoButton = /** @type {HTMLButtonElement} */ (byId("undo-button"));
const notice = byId("notice");
const form = /** @type {HTMLFormElement} */ (byId("add"));
const field = /** @type {HTMLTextAreaElement} */ (byId("new-item"));
const save = /** @type {HTMLButtonElement} */ (byId("save"));

/** Today's page or the archive. */
/** @type {View} */
let view = "active";
/** The items on the page being shown. */
/** @type {Item[]} */
let items = [];
let loaded = false;
let saving = false;
/** Today's page: the item open for editing, and its unsaved text. */
/** @type {string | null} */
let editingId = null;
let draft = "";
/** The archive, with a mouse: the item showing Restore and Delete. */
/** @type {string | null} */
let selectedId = null;
/** What the undo line is offering, while it shows. */
/** @type {{ key: string, timer: number, undo: (refocus: boolean) => void, expire: () => void } | null} */
let pendingUndo = null;
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

/**
 * keepalive lets the delete finish even if the page is closing.
 * @param {string} id
 */
function deleteRequest(id) {
  return api(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE", keepalive: true });
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

// ---- The heading ----

function renderDate() {
  const now = new Date();
  today.textContent = formatDay(now, navigator.language);
  today.dateTime = isoDay(now);
  renderHeading();
}

/** The heading is today's date, or "Archived"; tapping it flips between the two. */
function renderHeading() {
  // The spoken name starts with the visible words, then says what a tap does.
  if (view === "active") {
    flipLabel.replaceChildren(today);
    flip.setAttribute("aria-label", `${today.textContent}, show archived items`);
  } else {
    flipLabel.replaceChildren("Archived");
    flip.setAttribute("aria-label", "Archived, back to today");
  }
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

  if (view === "active" && item.id === editingId) {
    li.classList.add("editing");
    li.append(renderEditor(item));
  } else {
    li.append(renderOpenButton(item));
    if (view === "archived" && item.id === selectedId) {
      li.classList.add("selected");
      li.append(words(["Restore", "restore"], ["Delete", "delete"]));
    }
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
  editor.append(area);

  // On the phone these actions are swipes; with a mouse or trackpad they're words.
  if (finePointer.matches) editor.append(words([item.pinned ? "Unpin" : "Pin", "pin"], ["Archive", "archive"]));
  return editor;
}

/**
 * A row of quiet word buttons.
 * @param {...[string, string]} pairs  [label, action]
 */
function words(...pairs) {
  const row = document.createElement("div");
  row.className = "words";
  for (const [label, action] of pairs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word";
    button.dataset.action = action;
    button.textContent = label;
    row.append(button);
  }
  return row;
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
  const hadFocus = li.contains(document.activeElement);
  const fresh = renderItem(item);
  rendering = true;
  li.replaceWith(fresh);
  rendering = false;
  // Keep focus on the item, so keys like Esc still reach it.
  if (hadFocus) /** @type {HTMLElement | null} */ (fresh.querySelector(".open"))?.focus();
}

/** @param {string} id */
function focusItem(id) {
  /** @type {HTMLElement | null} */ (list.querySelector(`[data-id="${CSS.escape(id)}"] .open`))?.focus();
}

/**
 * Puts the latest copy of an item on the page, or takes it off if it now
 * belongs to the other view (archived or not).
 * @param {Item} item
 */
function putItem(item) {
  const belongs = (item.archivedAt === null) === (view === "active");
  items = items.filter((i) => i.id !== item.id);
  if (belongs) items = [...items, item].sort(view === "active" ? compareItems : compareArchived);
}

/** @param {string} id */
function dropItem(id) {
  items = items.filter((i) => i.id !== id);
}

// ---- Editing (today's page) ----

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
      if (editingId === null && view === "active") {
        editingId = original.id;
        draft = text;
      }
      render();
      showNotice(`Couldn't save your edit. ${describe(err)}`);
    },
  );
}

/**
 * Pins or unpins straight away (a swipe right on the phone).
 * @param {Item} item
 */
function togglePin(item) {
  const pinned = !item.pinned;
  putItem({ ...item, pinned });
  render();
  patchItem(item.id, { pinned }).then(
    ({ item: saved }) => putItem(saved),
    (err) => {
      putItem(item);
      render();
      showNotice(`Couldn't ${pinned ? "pin" : "unpin"} that item. ${describe(err)}`);
    },
  );
}

// ---- The archive, with a mouse ----

/**
 * Shows Restore and Delete under one archived item (or none).
 * @param {string | null} id
 * @param {boolean} [keyboard]  move focus to Restore
 */
function select(id, keyboard = false) {
  const previous = selectedId;
  selectedId = id;
  if (previous !== null) renderRow(previous);
  if (id === null) return;
  renderRow(id);
  if (keyboard) /** @type {HTMLElement | null} */ (list.querySelector(`[data-id="${CSS.escape(id)}"] .word`))?.focus();
}

// ---- Archive, restore, delete, and the undo line ----

/**
 * Shows the undo line. Whatever an earlier line was waiting on happens first.
 * @param {string} label  "Archived", "Restored" or "Deleted"
 * @param {string} key  the item it's about
 * @param {(refocus: boolean) => void} undo
 * @param {() => void} [expire]  runs when the line goes away without Undo
 */
function offerUndo(label, key, undo, expire = () => {}) {
  settleUndo();
  undoLabel.textContent = label;
  pendingUndo = { key, undo, expire, timer: window.setTimeout(settleUndo, UNDO_MS) };
  undoLine.hidden = false;
}

function takePending() {
  const pending = pendingUndo;
  if (pending) clearTimeout(pending.timer);
  pendingUndo = null;
  undoLine.hidden = true;
  return pending;
}

/** The line goes away: anything waiting on it (a delete) happens now. */
function settleUndo() {
  takePending()?.expire();
}

/** @param {boolean} refocus */
function useUndo(refocus) {
  takePending()?.undo(refocus);
}

/**
 * Hides the line for an item whose change failed anyway.
 * @param {string} key
 */
function dropUndo(key) {
  if (pendingUndo?.key === key) takePending();
}

// Give people time to reach Undo: pause the countdown while it's hovered or focused.
function pauseUndo() {
  if (pendingUndo) clearTimeout(pendingUndo.timer);
}

function resumeUndo() {
  if (!pendingUndo) return;
  clearTimeout(pendingUndo.timer);
  pendingUndo.timer = window.setTimeout(settleUndo, UNDO_MS);
}

/**
 * Moves an item between today's page and the archive. Sent at once; Undo moves it back.
 * @param {Item} item
 * @param {Patch} patch  { archived: true } or { archived: false }, maybe with a text change
 * @param {string} label  for the undo line
 * @param {string} failure  for the notice if the server refuses
 */
function move(item, patch, label, failure) {
  dropItem(item.id);
  render();
  const request = patchItem(item.id, patch).then(
    () => true,
    (err) => {
      dropUndo(item.id);
      putItem(item);
      render();
      showNotice(`${failure} ${describe(err)}`);
      return false;
    },
  );
  offerUndo(label, item.id, async (refocus) => {
    // Let the first change land, so the two requests can't arrive out of order.
    if (!(await request)) return;
    try {
      const { item: moved } = await patchItem(item.id, { archived: !patch.archived });
      putItem(moved);
      render();
      if (refocus) focusItem(moved.id);
      hideNotice();
    } catch (err) {
      showNotice(`Couldn't undo. ${describe(err)}`);
    }
  });
}

/**
 * @param {Item} item
 * @param {Patch} [patch]  may also carry a text change made just before archiving
 */
function archive(item, patch = { archived: true }) {
  move(item, patch, "Archived", "Couldn't archive that item.");
}

/** @param {Item} item */
function restore(item) {
  move(item, { archived: false }, "Restored", "Couldn't restore that item.");
}

/**
 * Deletes an archived item for good. Nothing is sent until the undo line goes away.
 * @param {Item} item
 */
function remove(item) {
  dropItem(item.id);
  render();
  offerUndo(
    "Deleted",
    item.id,
    (refocus) => {
      putItem(item);
      render();
      if (refocus) focusItem(item.id);
    },
    () => {
      deleteRequest(item.id).catch((err) => {
        showNotice(`Couldn't delete that item. ${describe(err)}`);
        if (view === "archived") loadItems();
      });
    },
  );
}

// ---- Views ----

/** @param {View} next */
function showView(next) {
  if (editingId !== null) commitEdit();
  selectedId = null;
  settleUndo();
  hideNotice();
  view = next;
  page.classList.toggle("archive", view === "archived");
  empty.textContent = view === "active" ? "A clean page." : "Nothing archived yet.";
  renderHeading();
  items = [];
  loaded = false;
  render();
  loadItems();
}

async function loadItems() {
  const forView = view;
  hideNotice();
  try {
    const body = await api(`/api/items?status=${forView}`);
    if (view !== forView) return; // flipped again while this was loading
    items = body.items;
    loaded = true;
    render();
  } catch (err) {
    if (view === forView) showNotice(`Couldn't load your items. ${describe(err)}`, loadItems);
  }
}

// ---- Adding ----

/** Enables the save arrow only when there's text, and grows the field with it. */
function syncField() {
  save.disabled = saving || field.value.trim() === "";
  sizeToContent(field);
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

/**
 * @param {(item: Item) => void} act
 * @returns {(id: string) => void}
 */
function onItem(act) {
  return (id) => {
    const item = items.find((i) => i.id === id);
    if (item) act(item);
  };
}

list.addEventListener("click", (event) => {
  const target = /** @type {Element} */ (event.target);
  const id = /** @type {HTMLElement | null} */ (target.closest(".item"))?.dataset.id;
  const item = items.find((i) => i.id === id);
  if (!item) return;
  // detail is 0 when a key, not a pointer, pressed the button.
  const keyboard = event.detail === 0;
  const action = /** @type {HTMLElement | null} */ (target.closest(".word"))?.dataset.action;

  if (action === "pin") {
    commitEdit({ pinned: !item.pinned }, keyboard);
  } else if (action === "archive" || action === "restore" || action === "delete") {
    if (action === "archive") commitEdit({ archived: true });
    else {
      selectedId = null;
      (action === "restore" ? restore : remove)(item);
    }
    if (keyboard) undoButton.focus();
  } else if (target.closest(".open")) {
    if (view === "active") openEditor(item.id);
    // In the archive the phone uses swipes; with a mouse, a tap shows Restore and Delete.
    else if (finePointer.matches) select(selectedId === item.id ? null : item.id, keyboard);
  }
});

// Keep the text focused while pressing Pin or Archive (iPhone buttons don't take focus).
list.addEventListener("pointerdown", (event) => {
  if (/** @type {Element} */ (event.target).closest(".editing .word")) event.preventDefault();
});

list.addEventListener("input", (event) => {
  const area = /** @type {HTMLTextAreaElement} */ (event.target);
  if (!area.classList.contains("edit-text")) return;
  draft = area.value;
  sizeToContent(area);
});

list.addEventListener("keydown", (event) => {
  const target = /** @type {Element} */ (event.target);
  if (target.classList.contains("edit-text")) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      commitEdit({}, finePointer.matches);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  } else if (event.key === "Escape" && selectedId !== null) {
    const id = selectedId;
    select(null);
    focusItem(id);
  }
});

// Leaving the item (tapping elsewhere, tabbing away) saves it.
list.addEventListener("focusout", (event) => {
  if (rendering || editingId === null) return;
  const li = /** @type {Element} */ (event.target).closest(".editing");
  const next = /** @type {Node | null} */ (event.relatedTarget);
  if (li && !(next && li.contains(next))) commitEdit();
});

document.addEventListener("pointerdown", (event) => {
  const target = /** @type {Element} */ (event.target);
  // On iPhone, tapping a blank spot doesn't blur the text field, so do it here.
  if (editingId !== null && !target.closest(".editing")) editArea()?.blur();
  if (selectedId !== null && !target.closest(".selected")) select(null);
});

enableSwipe(list, (direction) => {
  if (view === "active") {
    return direction === "left" ? { leaves: true, run: onItem(archive) } : { leaves: false, run: onItem(togglePin) };
  }
  return direction === "left" ? { leaves: true, run: onItem(restore) } : { leaves: true, run: onItem(remove) };
});

flip.addEventListener("click", () => showView(view === "active" ? "archived" : "active"));

undoButton.addEventListener("click", (event) => useUndo(event.detail === 0));
undoLine.addEventListener("pointerenter", pauseUndo);
undoLine.addEventListener("pointerleave", resumeUndo);
undoLine.addEventListener("focusin", pauseUndo);
undoLine.addEventListener("focusout", resumeUndo);

// Keep the date right when the app comes back after midnight. When the page is
// hidden or closed, anything waiting on the undo line (a delete) is sent now.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderDate();
  else settleUndo();
});
window.addEventListener("pagehide", settleUndo);

renderDate();
syncField();
// Phones only show the keyboard after a tap, so focus on load only with a mouse.
if (finePointer.matches) field.focus();
loadItems();
