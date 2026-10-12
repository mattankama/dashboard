import type { ItemPatch, ItemStatus, NewItem } from "./validate";

export interface Item {
  id: string;
  text: string;
  category: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

interface ItemRow {
  id: string;
  text: string;
  category: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    text: row.text,
    category: row.category,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

// rowid breaks ties between items written in the same millisecond.
const ORDER_BY: Record<ItemStatus, string> = {
  active: "pinned DESC, created_at DESC, rowid DESC",
  archived: "archived_at DESC, rowid DESC",
};

const WHERE: Record<ItemStatus, string> = {
  active: "archived_at IS NULL",
  archived: "archived_at IS NOT NULL",
};

export async function listItems(db: D1Database, status: ItemStatus): Promise<Item[]> {
  const { results } = await db
    .prepare(`SELECT * FROM items WHERE ${WHERE[status]} ORDER BY ${ORDER_BY[status]}`)
    .all<ItemRow>();
  return results.map(toItem);
}

export async function insertItem(db: D1Database, input: NewItem): Promise<Item> {
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `INSERT INTO items (id, text, category, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(crypto.randomUUID(), input.text, input.category, input.pinned ? 1 : 0, now, now)
    .first<ItemRow>();
  if (row === null) throw new Error("INSERT ... RETURNING returned no row");
  return toItem(row);
}

// Column names come from this fixed list, never from the request; values are always bound.
export async function updateItem(db: D1Database, id: string, patch: ItemPatch): Promise<Item | null> {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const values: unknown[] = [now];

  if (patch.text !== undefined) {
    sets.push("text = ?");
    values.push(patch.text);
  }
  if (patch.category !== undefined) {
    sets.push("category = ?");
    values.push(patch.category);
  }
  if (patch.pinned !== undefined) {
    sets.push("pinned = ?");
    values.push(patch.pinned ? 1 : 0);
  }
  if (patch.archived === true) {
    // Archiving an already-archived item keeps its original archive time.
    sets.push("archived_at = COALESCE(archived_at, ?)");
    values.push(now);
  }
  if (patch.archived === false) sets.push("archived_at = NULL");

  const row = await db
    .prepare(`UPDATE items SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...values, id)
    .first<ItemRow>();
  return row === null ? null : toItem(row);
}

/** Deletes an item for good. Returns false if there was no such item. */
export async function deleteItem(db: D1Database, id: string): Promise<boolean> {
  const { meta } = await db.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  return meta.changes > 0;
}
