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

export function validateStatus(param: string | null): Result<ItemStatus> {
  if (param === null || param === "active") return { ok: true, value: "active" };
  if (param === "archived") return { ok: true, value: "archived" };
  return { ok: false, message: "status must be active or archived" };
}
