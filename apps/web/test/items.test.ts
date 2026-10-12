import { env, exports } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

function post(body: unknown, contentType = "application/json") {
  return exports.default.fetch("http://localhost/api/items", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function create(body: Record<string, unknown>) {
  const res = await post(body);
  expect(res.status).toBe(201);
  return ((await res.json()) as { item: { id: string; text: string } }).item;
}

async function list(query = "") {
  const res = await exports.default.fetch(`http://localhost/api/items${query}`);
  return { res, body: (await res.json()) as { items: { id: string; text: string }[] } };
}

describe("POST /api/items", () => {
  it("creates an item and returns it in the spec's shape", async () => {
    const res = await post({ text: "Call Grandma", category: "People" });

    expect(res.status).toBe(201);
    const { item } = (await res.json()) as { item: Record<string, unknown> };
    expect(item).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      text: "Call Grandma",
      category: "People",
      pinned: false,
      createdAt: expect.any(String),
      updatedAt: item.createdAt,
      archivedAt: null,
    });
  });

  it("stores the item in the database", async () => {
    const item = await create({ text: "Read Thinking in Systems" });

    const row = await env.DB.prepare("SELECT text FROM items WHERE id = ?").bind(item.id).first();
    expect(row).toEqual({ text: "Read Thinking in Systems" });
  });

  it("keeps HTML, quotes, emoji and newlines exactly as typed", async () => {
    const text = `<b>hi</b> "quoted" 'single' 🌱\nsecond line`;
    const item = await create({ text });

    const { body } = await list();
    expect(item.text).toBe(text);
    expect(body.items[0].text).toBe(text);
  });

  it("returns 400 with a message for invalid input", async () => {
    const res = await post({ text: "" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "text is required" });
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await post("{not json");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 415 when the body isn't sent as JSON", async () => {
    const res = await post("text=hi", "application/x-www-form-urlencoded");

    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: "Content-Type must be application/json" });
  });

  it("accepts a JSON content type with a charset", async () => {
    const res = await post({ text: "x" }, "application/json; charset=utf-8");
    expect(res.status).toBe(201);
  });
});

describe("GET /api/items", () => {
  it("lists active items, pinned first, then newest first", async () => {
    const oldest = await create({ text: "oldest" });
    const pinned = await create({ text: "pinned", pinned: true });
    const newest = await create({ text: "newest" });

    const { res, body } = await list();
    expect(res.status).toBe(200);
    expect(body.items.map((i) => i.id)).toEqual([pinned.id, newest.id, oldest.id]);
  });

  it("defaults to active items", async () => {
    const active = await create({ text: "active" });
    const archived = await create({ text: "archived" });
    await env.DB.prepare("UPDATE items SET archived_at = ? WHERE id = ?").bind(new Date().toISOString(), archived.id).run();

    const { body } = await list();
    expect(body.items.map((i) => i.id)).toEqual([active.id]);
  });

  it("lists archived items, most recently archived first", async () => {
    const first = await create({ text: "archived first" });
    const second = await create({ text: "archived second" });
    await create({ text: "still active" });
    await env.DB.batch([
      env.DB.prepare("UPDATE items SET archived_at = '2026-10-01T00:00:00.000Z' WHERE id = ?").bind(first.id),
      env.DB.prepare("UPDATE items SET archived_at = '2026-10-02T00:00:00.000Z' WHERE id = ?").bind(second.id),
    ]);

    const { body } = await list("?status=archived");
    expect(body.items.map((i) => i.id)).toEqual([second.id, first.id]);
  });

  it("returns an empty list when there are no items", async () => {
    const { res, body } = await list();
    expect(res.status).toBe(200);
    expect(body).toEqual({ items: [] });
  });

  it("returns 400 for an unknown status", async () => {
    const { res, body } = await list("?status=done");
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "status must be active or archived" });
  });
});

describe("routing", () => {
  it("returns 405 with an Allow header for an unsupported method", async () => {
    const res = await exports.default.fetch("http://localhost/api/items", { method: "PUT" });

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, POST");
    expect(await res.json()).toEqual({ error: "Method not allowed" });
  });
});

function patch(id: string, body: unknown, contentType = "application/json") {
  return exports.default.fetch(`http://localhost/api/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

type ItemBody = { item: { id: string; text: string; pinned: boolean; createdAt: string; updatedAt: string; archivedAt: string | null } };

describe("PATCH /api/items/:id", () => {
  it("changes the text and records when it changed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T09:00:00.000Z"));
    const item = await create({ text: "Cal Grandma" });
    vi.setSystemTime(new Date("2026-10-11T10:30:00.000Z"));

    const res = await patch(item.id, { text: "Call Grandma" });
    vi.useRealTimers();

    expect(res.status).toBe(200);
    const body = (await res.json()) as ItemBody;
    expect(body.item).toMatchObject({
      id: item.id,
      text: "Call Grandma",
      createdAt: "2026-10-11T09:00:00.000Z",
      updatedAt: "2026-10-11T10:30:00.000Z",
    });
  });

  it("leaves fields it wasn't given alone", async () => {
    const item = await create({ text: "keep me", category: "People", pinned: true });

    const res = await patch(item.id, { text: "kept" });

    const body = (await res.json()) as { item: Record<string, unknown> };
    expect(body.item).toMatchObject({ text: "kept", category: "People", pinned: true, archivedAt: null });
  });

  it("pinning moves an item to the top of the active list", async () => {
    const older = await create({ text: "older" });
    const newer = await create({ text: "newer" });

    await patch(older.id, { pinned: true });

    const { body } = await list();
    expect(body.items.map((i) => i.id)).toEqual([older.id, newer.id]);
  });

  it("archiving moves an item to the archived list, and restoring brings it back", async () => {
    const item = await create({ text: "done with this" });

    const archived = (await (await patch(item.id, { archived: true })).json()) as ItemBody;
    expect(archived.item.archivedAt).toEqual(expect.any(String));
    expect((await list()).body.items).toEqual([]);
    expect((await list("?status=archived")).body.items.map((i) => i.id)).toEqual([item.id]);

    const restored = (await (await patch(item.id, { archived: false })).json()) as ItemBody;
    expect(restored.item.archivedAt).toBeNull();
    expect((await list()).body.items.map((i) => i.id)).toEqual([item.id]);
  });

  it("keeps the original archive time when an archived item is archived again", async () => {
    const item = await create({ text: "x" });
    const first = (await (await patch(item.id, { archived: true })).json()) as ItemBody;

    const again = (await (await patch(item.id, { archived: true })).json()) as ItemBody;

    expect(again.item.archivedAt).toBe(first.item.archivedAt);
  });

  it("changes several fields at once", async () => {
    const item = await create({ text: "x" });

    const res = await patch(item.id, { text: "y", pinned: true });

    expect(((await res.json()) as ItemBody).item).toMatchObject({ text: "y", pinned: true });
  });

  it("returns 404 for an unknown id", async () => {
    const res = await patch("no-such-id", { pinned: true });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Item not found" });
  });

  it("returns 400 for an empty update", async () => {
    const item = await create({ text: "x" });

    const res = await patch(item.id, {});

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Nothing to update" });
  });

  it("returns 415 when the body isn't JSON", async () => {
    const item = await create({ text: "x" });

    const res = await patch(item.id, "pinned=true", "application/x-www-form-urlencoded");

    expect(res.status).toBe(415);
  });

  it("returns 405 for an unsupported method", async () => {
    const res = await exports.default.fetch("http://localhost/api/items/abc", { method: "PUT" });

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("PATCH, DELETE");
  });
});

function remove(id: string) {
  return exports.default.fetch(`http://localhost/api/items/${id}`, { method: "DELETE" });
}

describe("DELETE /api/items/:id", () => {
  it("deletes the item for good", async () => {
    const item = await create({ text: "gone" });

    const res = await remove(item.id);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    const row = await env.DB.prepare("SELECT id FROM items WHERE id = ?").bind(item.id).first();
    expect(row).toBeNull();
  });

  it("returns 404 for an unknown id, including a second delete", async () => {
    const item = await create({ text: "gone" });
    await remove(item.id);

    const res = await remove(item.id);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Item not found" });
  });
});
