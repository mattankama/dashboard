import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { dashboardApi } from "../src/api.ts";
import { sendJson, startHttpServer, type FakeServer } from "./fakes.ts";

const TOKEN = "secret-printer-token";
const ITEM = {
  id: "a1",
  text: "Call Grandma",
  category: null,
  pinned: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  archivedAt: null,
};

const servers: FakeServer[] = [];
after(async () => Promise.all(servers.map((s) => s.close())));

async function server(handler: Parameters<typeof startHttpServer>[0]) {
  const s = await startHttpServer(handler);
  servers.push(s);
  return s;
}

describe("activeItems", () => {
  it("fetches the active items with the bearer token", async () => {
    const s = await server((_req, res) => sendJson(res, 200, { items: [ITEM] }));

    const items = await dashboardApi(s.url, TOKEN).activeItems();

    assert.deepEqual(items, [ITEM]);
    assert.equal(s.requests[0].url, "/api/printer/items");
    assert.equal(s.requests[0].headers.authorization, `Bearer ${TOKEN}`);
  });

  it("reports a refused request without leaking the token", async () => {
    const s = await server((_req, res) => sendJson(res, 401, { error: "Unauthorized" }));

    await assert.rejects(dashboardApi(s.url, TOKEN).activeItems(), (err: Error) => {
      assert.equal(err.message, "items request failed: HTTP 401 (Unauthorized)");
      assert.ok(!err.message.includes(TOKEN));
      return true;
    });
  });

  it("rejects an answer that isn't a list of items", async () => {
    const s = await server((_req, res) => sendJson(res, 200, { items: [{ id: 3 }] }));

    await assert.rejects(dashboardApi(s.url, TOKEN).activeItems(), /items request failed: unexpected response/);
  });

  it("gives up after the timeout", async () => {
    const s = await server(() => {
      /* never answers */
    });

    await assert.rejects(dashboardApi(s.url, TOKEN, { timeoutMs: 100 }).activeItems(), /items request failed: timed out/);
  });

  it("reports a server that isn't there", async () => {
    await assert.rejects(dashboardApi("http://127.0.0.1:9", TOKEN).activeItems(), /items request failed: /);
  });
});

describe("through Cloudflare Access", () => {
  it("sends the service token on every request when it's configured", async () => {
    const s = await server((req, res) => (req.method === "POST" ? sendJson(res, 201, { run: {} }) : sendJson(res, 200, { items: [] })));
    const api = dashboardApi(s.url, TOKEN, { accessServiceToken: { id: "client-id.access", secret: "client-secret" } });

    await api.activeItems();
    await api.recordRun({ week: "2026-W41", status: "printed", printedAt: null, emailedAt: null });

    for (const request of s.requests) {
      assert.equal(request.headers["cf-access-client-id"], "client-id.access");
      assert.equal(request.headers["cf-access-client-secret"], "client-secret");
      assert.equal(request.headers.authorization, `Bearer ${TOKEN}`);
    }
  });

  it("sends no Access headers when there's no service token", async () => {
    const s = await server((_req, res) => sendJson(res, 200, { items: [] }));

    await dashboardApi(s.url, TOKEN).activeItems();

    assert.equal(s.requests[0].headers["cf-access-client-id"], undefined);
  });
});

describe("recordRun", () => {
  it("posts the run as JSON with the token", async () => {
    const s = await server((_req, res) => sendJson(res, 201, { run: {} }));

    await dashboardApi(s.url, TOKEN).recordRun({ week: "2026-W41", status: "printed", printedAt: "2026-10-11T16:02:00.000Z", emailedAt: null });

    const [request] = s.requests;
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/printer/runs");
    assert.equal(request.headers["content-type"], "application/json");
    assert.equal(request.headers.authorization, `Bearer ${TOKEN}`);
    assert.deepEqual(JSON.parse(request.body), {
      week: "2026-W41",
      status: "printed",
      printedAt: "2026-10-11T16:02:00.000Z",
      emailedAt: null,
    });
  });

  it("reports a refused run", async () => {
    const s = await server((_req, res) => sendJson(res, 400, { error: "week must be an ISO week like 2026-W41" }));

    await assert.rejects(
      dashboardApi(s.url, TOKEN).recordRun({ week: "bad", status: "failed", printedAt: null, emailedAt: null }),
      /run request failed: HTTP 400 \(week must be an ISO week like 2026-W41\)/,
    );
  });
});
