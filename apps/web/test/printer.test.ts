import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

const TOKEN = "test-printer-token"; // set in vitest.config.ts

function printer(path: string, init: RequestInit = {}, token: string | null = TOKEN) {
  const headers = new Headers(init.headers);
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);
  return exports.default.fetch(`http://localhost/api/printer/${path}`, { ...init, headers });
}

function postRun(body: unknown, token: string | null = TOKEN) {
  return printer("runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token);
}

async function addItem(text: string, extra: Record<string, unknown> = {}) {
  const res = await exports.default.fetch("http://localhost/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...extra }),
  });
  return ((await res.json()) as { item: { id: string } }).item;
}

describe("printer auth", () => {
  it("refuses a request with no token", async () => {
    const res = await printer("items", {}, null);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("refuses a wrong token, including one that only shares a prefix", async () => {
    for (const token of ["wrong", `${TOKEN}x`, TOKEN.slice(0, -1)]) {
      expect((await printer("items", {}, token)).status).toBe(401);
    }
  });

  it("refuses a token sent without the Bearer scheme", async () => {
    const res = await exports.default.fetch("http://localhost/api/printer/items", { headers: { Authorization: TOKEN } });
    expect(res.status).toBe(401);
  });

  it("returns 503, never open access, when no token is configured", async () => {
    const res = await worker.fetch(new Request("http://localhost/api/printer/items", { headers: { Authorization: "Bearer " } }), {
      ...env,
      PRINTER_TOKEN: undefined,
    });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Printer access isn't configured" });
  });
});

describe("GET /api/printer/items", () => {
  it("returns active items in the same shape and order as the app", async () => {
    const older = await addItem("older");
    const pinned = await addItem("pinned", { pinned: true });
    const archived = await addItem("archived");
    await exports.default.fetch(`http://localhost/api/items/${archived.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    const res = await printer("items");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string; text: string; archivedAt: string | null }[] };
    expect(body.items.map((i) => i.id)).toEqual([pinned.id, older.id]);
    expect(body.items[0]).toMatchObject({ text: "pinned", archivedAt: null });
  });
});

describe("POST /api/printer/runs", () => {
  it("records a run", async () => {
    const res = await postRun({ week: "2026-W41", status: "printed", printedAt: "2026-10-11T09:02:00.000Z", emailedAt: "2026-10-11T09:03:00.000Z" });

    expect(res.status).toBe(201);
    const { run } = (await res.json()) as { run: Record<string, unknown> };
    expect(run).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      week: "2026-W41",
      status: "printed",
      printedAt: "2026-10-11T09:02:00.000Z",
      emailedAt: "2026-10-11T09:03:00.000Z",
      createdAt: expect.any(String),
    });
    const row = await env.DB.prepare("SELECT week, status FROM print_runs WHERE id = ?").bind(run.id).first();
    expect(row).toEqual({ week: "2026-W41", status: "printed" });
  });

  it("records a failed run with no timestamps", async () => {
    const res = await postRun({ week: "2026-W41", status: "failed" });

    expect(res.status).toBe(201);
    expect(((await res.json()) as { run: Record<string, unknown> }).run).toMatchObject({ printedAt: null, emailedAt: null });
  });

  it("rejects a malformed week", async () => {
    for (const week of ["2026-41", "2026-W00", "2026-W54", "26-W41", 2026]) {
      const res = await postRun({ week, status: "printed" });
      expect(res.status, String(week)).toBe(400);
    }
  });

  it("rejects an unknown status", async () => {
    const res = await postRun({ week: "2026-W41", status: "lost" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "status must be printed, emailed_only or failed" });
  });

  it("rejects a timestamp that isn't ISO 8601", async () => {
    const res = await postRun({ week: "2026-W41", status: "printed", printedAt: "Sunday morning" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "printedAt must be an ISO 8601 date-time" });
  });

  it("rejects unknown fields", async () => {
    const res = await postRun({ week: "2026-W41", status: "printed", items: 12 });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unknown field: items" });
  });

  it("needs the token like every printer route", async () => {
    const res = await postRun({ week: "2026-W41", status: "printed" }, null);
    expect(res.status).toBe(401);
  });
});
