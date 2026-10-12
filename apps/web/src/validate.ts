export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

export const TEXT_MAX = 500;
export const CATEGORY_MAX = 40;

export interface NewItem {
  text: string;
  category: string | null;
  pinned: boolean;
}

export type ItemStatus = "active" | "archived";

const NEW_ITEM_FIELDS = new Set(["text", "category", "pinned"]);

// Count user-visible characters (code points), so an emoji counts as one.
function length(s: string): number {
  return [...s].length;
}

function isObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

function unknownField(body: Record<string, unknown>, allowed: Set<string>): string | undefined {
  return Object.keys(body).find((key) => !allowed.has(key));
}

function validateText(value: unknown): Result<string> {
  if (value === undefined) return { ok: false, message: "text is required" };
  if (typeof value !== "string") return { ok: false, message: "text must be a string" };
  const text = value.trim();
  if (text === "") return { ok: false, message: "text is required" };
  if (length(text) > TEXT_MAX) return { ok: false, message: `text must be at most ${TEXT_MAX} characters` };
  return { ok: true, value: text };
}

function validateCategory(value: unknown): Result<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, message: "category must be a string or null" };
  const category = value.trim();
  if (category === "") return { ok: true, value: null };
  if (length(category) > CATEGORY_MAX) {
    return { ok: false, message: `category must be at most ${CATEGORY_MAX} characters` };
  }
  return { ok: true, value: category };
}

function validateBoolean(name: string, value: unknown): Result<boolean> {
  if (typeof value !== "boolean") return { ok: false, message: `${name} must be true or false` };
  return { ok: true, value };
}

export function validateNewItem(body: unknown): Result<NewItem> {
  if (!isObject(body)) return { ok: false, message: "Body must be a JSON object" };

  const unknown = unknownField(body, NEW_ITEM_FIELDS);
  if (unknown !== undefined) return { ok: false, message: `Unknown field: ${unknown}` };

  const text = validateText(body.text);
  if (!text.ok) return text;

  const category = validateCategory(body.category);
  if (!category.ok) return category;

  const pinned = body.pinned === undefined ? { ok: true as const, value: false } : validateBoolean("pinned", body.pinned);
  if (!pinned.ok) return pinned;

  return { ok: true, value: { text: text.value, category: category.value, pinned: pinned.value } };
}

export interface ItemPatch {
  text?: string;
  category?: string | null;
  pinned?: boolean;
  archived?: boolean;
}

const PATCH_FIELDS = new Set(["text", "category", "pinned", "archived"]);

// Each field present is validated with the same rules as creating an item.
export function validatePatch(body: unknown): Result<ItemPatch> {
  if (!isObject(body)) return { ok: false, message: "Body must be a JSON object" };

  const unknown = unknownField(body, PATCH_FIELDS);
  if (unknown !== undefined) return { ok: false, message: `Unknown field: ${unknown}` };
  if (Object.keys(body).length === 0) return { ok: false, message: "Nothing to update" };

  const patch: ItemPatch = {};
  if ("text" in body) {
    const text = validateText(body.text);
    if (!text.ok) return text;
    patch.text = text.value;
  }
  if ("category" in body) {
    const category = validateCategory(body.category);
    if (!category.ok) return category;
    patch.category = category.value;
  }
  if ("pinned" in body) {
    const pinned = validateBoolean("pinned", body.pinned);
    if (!pinned.ok) return pinned;
    patch.pinned = pinned.value;
  }
  if ("archived" in body) {
    const archived = validateBoolean("archived", body.archived);
    if (!archived.ok) return archived;
    patch.archived = archived.value;
  }
  return { ok: true, value: patch };
}

export function validateStatus(param: string | null): Result<ItemStatus> {
  if (param === null || param === "active") return { ok: true, value: "active" };
  if (param === "archived") return { ok: true, value: "archived" };
  return { ok: false, message: "status must be active or archived" };
}

// Long enough for any password manager's password; anything longer is refused unread.
export const PASSWORD_MAX = 1024;
const LOGIN_FIELDS = new Set(["password"]);

export function validateLogin(body: unknown): Result<string> {
  if (!isObject(body)) return { ok: false, message: "Body must be a JSON object" };

  const unknown = unknownField(body, LOGIN_FIELDS);
  if (unknown !== undefined) return { ok: false, message: `Unknown field: ${unknown}` };
  if (typeof body.password !== "string" || body.password === "") return { ok: false, message: "password is required" };
  if (body.password.length > PASSWORD_MAX) {
    return { ok: false, message: `password must be at most ${PASSWORD_MAX} characters` };
  }
  return { ok: true, value: body.password };
}

export type RunStatus = "printed" | "emailed_only" | "failed";

export interface NewRun {
  week: string;
  status: RunStatus;
  printedAt: string | null;
  emailedAt: string | null;
}

const RUN_FIELDS = new Set(["week", "status", "printedAt", "emailedAt"]);
const RUN_STATUSES = new Set<string>(["printed", "emailed_only", "failed"]);
// ISO week, e.g. 2026-W41 (weeks 01-53).
const ISO_WEEK = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function validateTimestamp(name: string, value: unknown): Result<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string" || !ISO_DATE_TIME.test(value) || Number.isNaN(Date.parse(value))) {
    return { ok: false, message: `${name} must be an ISO 8601 date-time` };
  }
  return { ok: true, value };
}

export function validateRun(body: unknown): Result<NewRun> {
  if (!isObject(body)) return { ok: false, message: "Body must be a JSON object" };

  const unknown = unknownField(body, RUN_FIELDS);
  if (unknown !== undefined) return { ok: false, message: `Unknown field: ${unknown}` };

  if (typeof body.week !== "string" || !ISO_WEEK.test(body.week)) {
    return { ok: false, message: "week must be an ISO week like 2026-W41" };
  }
  if (typeof body.status !== "string" || !RUN_STATUSES.has(body.status)) {
    return { ok: false, message: "status must be printed, emailed_only or failed" };
  }
  const printedAt = validateTimestamp("printedAt", body.printedAt);
  if (!printedAt.ok) return printedAt;
  const emailedAt = validateTimestamp("emailedAt", body.emailedAt);
  if (!emailedAt.ok) return emailedAt;

  return {
    ok: true,
    value: { week: body.week, status: body.status as RunStatus, printedAt: printedAt.value, emailedAt: emailedAt.value },
  };
}
