import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

async function columns(table: string): Promise<string[]> {
  const { results } = await env.DB.prepare(`SELECT name FROM pragma_table_info(?)`)
    .bind(table)
    .all<{ name: string }>();
  return results.map((r) => r.name);
}

const now = "2026-10-11T09:00:00.000Z";

describe("schema", () => {
  it("creates the items table with the spec's columns", async () => {
    expect(await columns("items")).toEqual([
      "id", "text", "category", "pinned", "created_at", "updated_at", "archived_at",
    ]);
  });

  it("creates the print_runs table with the spec's columns", async () => {
    expect(await columns("print_runs")).toEqual([
      "id", "week", "printed_at", "emailed_at", "status", "created_at",
    ]);
  });

  it("defaults pinned to 0", async () => {
    await env.DB.prepare(`INSERT INTO items (id, text, created_at, updated_at) VALUES ('a', 'x', ?, ?)`)
      .bind(now, now)
      .run();
    const row = await env.DB.prepare(`SELECT pinned FROM items WHERE id = 'a'`).first<{ pinned: number }>();
    expect(row?.pinned).toBe(0);
  });

  it("rejects a pinned value other than 0 or 1", async () => {
    const insert = env.DB.prepare(
      `INSERT INTO items (id, text, pinned, created_at, updated_at) VALUES ('b', 'x', 2, ?, ?)`,
    ).bind(now, now);
    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/);
  });

  it("rejects an unknown print run status", async () => {
    const insert = env.DB.prepare(
      `INSERT INTO print_runs (id, week, status, created_at) VALUES ('r', '2026-W41', 'lost', ?)`,
    ).bind(now);
    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/);
  });
});
