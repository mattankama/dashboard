import { env, exports } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";

describe("routing", () => {
  it("returns a JSON 404 for an unknown /api path", async () => {
    const res = await exports.default.fetch("http://localhost/api/nope");

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("serves the app's HTML at /", async () => {
    const res = await exports.default.fetch("http://localhost/");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toContain("<title>Dashboard</title>");
  });

  it("links the home-screen manifest and icons", async () => {
    const html = await (await exports.default.fetch("http://localhost/")).text();

    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<link rel="icon" href="/icon.svg" type="image/svg+xml" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
  });

  it("serves the app's files with the right types", async () => {
    const assets = [
      ["/app.js", "javascript"],
      ["/lib.js", "javascript"],
      ["/swipe.js", "javascript"],
      ["/style.css", "text/css"],
      ["/manifest.webmanifest", "manifest+json"],
      ["/icon.svg", "image/svg+xml"],
      ["/apple-touch-icon.png", "image/png"],
      ["/icon-192.png", "image/png"],
      ["/icon-512.png", "image/png"],
    ];
    for (const [path, type] of assets) {
      const res = await exports.default.fetch(`http://localhost${path}`);

      expect(res.status, path).toBe(200);
      expect(res.headers.get("Content-Type"), path).toContain(type);
    }
  });
});

describe("unexpected errors", () => {
  it("returns a generic 500 and logs the detail server-side", async () => {
    const brokenDb = {
      prepare() {
        throw new Error("database exploded: secret detail");
      },
    } as unknown as D1Database;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await worker.fetch(new Request("http://localhost/api/items"), { ...env, DB: brokenDb });

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"error":"Internal error"}');
    expect(logged).toHaveBeenCalledWith("Unhandled error", "GET", "/api/items", expect.any(Error));
    logged.mockRestore();
  });
});
