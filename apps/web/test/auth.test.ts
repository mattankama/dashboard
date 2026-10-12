import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { COOKIE, createSession } from "../src/auth";
import worker from "../src/index";

const SITE = "https://dashboard.mattan.workers.dev";
const PASSWORD = "correct horse battery staple, twice";
const SECRET = "a".repeat(64);
const setUp = { ...env, LOGIN_PASSWORD: PASSWORD, SESSION_SECRET: SECRET };
const login = { password: PASSWORD, secret: SECRET };

// Typed as a request arriving at the Worker, as its fetch handler expects.
type Incoming = Request<unknown, IncomingRequestCfProperties>;
function request(path: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", `${COOKIE}=${cookie}`);
  return new Request(`${SITE}${path}`, { ...init, headers }) as Incoming;
}
const signIn = (password: unknown, contentType = "application/json") =>
  request("/api/login", { method: "POST", headers: { "Content-Type": contentType }, body: JSON.stringify({ password }) });

/** The session value from a Set-Cookie header. */
function sessionFrom(res: Response): string {
  const match = new RegExp(`^${COOKIE}=([^;]+)`).exec(res.headers.get("Set-Cookie") ?? "");
  expect(match).not.toBeNull();
  return match![1];
}

describe("signing in", () => {
  it("refuses the item API without a session", async () => {
    const res = await worker.fetch(request("/api/items"), setUp);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in" });
  });

  it("refuses a wrong password and sets no cookie", async () => {
    const res = await worker.fetch(signIn("guess"), setUp);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Wrong password" });
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("gives the right password a locked-down session cookie for a year", async () => {
    const res = await worker.fetch(signIn(PASSWORD), setUp);

    expect(res.status).toBe(204);
    const cookie = res.headers.get("Set-Cookie")!;
    expect(cookie.startsWith(`${COOKIE}=`)).toBe(true);
    for (const part of ["Path=/", "Max-Age=31536000", "HttpOnly", "Secure", "SameSite=Strict"]) expect(cookie).toContain(part);
    expect(cookie).not.toContain(PASSWORD);
  });

  it("lets the session use the item API", async () => {
    const session = sessionFrom(await worker.fetch(signIn(PASSWORD), setUp));

    const res = await worker.fetch(request("/api/items", {}, session), setUp);
    expect(res.status).toBe(200);
  });

  it("checks how the password is sent", async () => {
    expect((await worker.fetch(signIn(PASSWORD, "text/plain"), setUp)).status).toBe(415);
    expect((await worker.fetch(signIn(42), setUp)).status).toBe(400);
    expect((await worker.fetch(signIn("x".repeat(2000)), setUp)).status).toBe(400);
  });
});

describe("sessions that don't count", () => {
  const items = (session: string) => worker.fetch(request("/api/items", {}, session), setUp);

  it("a tampered cookie", async () => {
    const session = sessionFrom(await worker.fetch(signIn(PASSWORD), setUp));
    const [expires, signature] = session.split(".");
    const otherSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

    expect((await items(`${Number(expires) + 1}.${signature}`)).status).toBe(401);
    expect((await items(`${expires}.${otherSignature}`)).status).toBe(401);
    expect((await items("garbage")).status).toBe(401);
  });

  it("an expired one", async () => {
    const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
    expect((await items(await createSession(login, twoYearsAgo))).status).toBe(401);
  });

  it("one from before either secret changed (that's how to sign out everywhere)", async () => {
    expect((await items(await createSession(login, Date.now()))).status).toBe(200);
    expect((await items(await createSession({ ...login, secret: "b".repeat(64) }, Date.now()))).status).toBe(401);
    expect((await items(await createSession({ ...login, password: "an older password, also long" }, Date.now()))).status).toBe(401);
  });
});

describe("before login is set up", () => {
  it("a deployed app refuses everything rather than running open", async () => {
    expect((await worker.fetch(request("/api/items"), env)).status).toBe(503);
    const res = await worker.fetch(signIn(PASSWORD), env);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Login isn't set up" });
  });

  it("a password that's too short counts as not set up", async () => {
    const weak = { ...env, LOGIN_PASSWORD: "short", SESSION_SECRET: SECRET };
    expect((await worker.fetch(request("/api/items"), weak)).status).toBe(503);
  });

  it("local dev stays open, and asks for a password once one is set", async () => {
    const local = (e: Env) => worker.fetch(new Request("http://localhost/api/items") as Incoming, e);

    expect((await local(env)).status).toBe(200);
    expect((await local(setUp)).status).toBe(401);
  });
});

describe("the rest of the API", () => {
  it("leaves the printer routes to their bearer token", async () => {
    const res = await worker.fetch(request("/api/printer/items", { headers: { Authorization: "Bearer test-printer-token" } }), setUp);
    expect(res.status).toBe(200);
  });

  it("marks every API reply as not to be sniffed or cached", async () => {
    for (const res of [await worker.fetch(request("/api/items"), setUp), await worker.fetch(signIn(PASSWORD), setUp)]) {
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});
