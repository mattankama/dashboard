import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

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
});
