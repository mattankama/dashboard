import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { checkAccess } from "../src/access";
import worker from "../src/index";

const TEAM = "https://mattan-test.cloudflareaccess.com";
const AUD = "aud-tag-for-dashboard";
const SITE = "https://dashboard.mattan.workers.dev";
const configured = { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64json = (value: unknown) => b64url(encoder.encode(JSON.stringify(value)));

async function keyPair(kid: string) {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return { privateKey: pair.privateKey, jwk: { ...jwk, kid, alg: "RS256", use: "sig" } };
}

const signing = await keyPair("key-1");
const impostor = await keyPair("key-1"); // same kid, different key

async function token(claims: Record<string, unknown> = {}, { key = signing.privateKey, header = { alg: "RS256", kid: "key-1" } } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64json(header)}.${b64json({ aud: [AUD], iss: TEAM, iat: now, exp: now + 3600, email: "me@example.com", ...claims })}`;
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(body)));
  return `${body}.${b64url(signature)}`;
}

/** Cloudflare's certs endpoint, faked. Counts calls so caching can be checked. */
function certs(keys = [signing.jwk]) {
  const calls: string[] = [];
  const fetchCerts = async (url: string) => {
    calls.push(url);
    return Response.json({ keys });
  };
  return { fetchCerts, calls };
}

// Typed as a request arriving at the Worker, as its fetch handler expects.
type Incoming = Request<unknown, IncomingRequestCfProperties>;
const request = (jwt?: string, url = `${SITE}/api/items`) =>
  new Request(url, { headers: jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {} }) as Incoming;

describe("checkAccess", () => {
  it("lets a valid Access token through, using the team's certs", async () => {
    const { fetchCerts, calls } = certs();

    expect(await checkAccess(request(await token()), configured, { fetchCerts })).toBeNull();
    expect(calls).toEqual([`${TEAM}/cdn-cgi/access/certs`]);
  });

  it("accepts the team domain without https:// and the audience as a plain string", async () => {
    const { fetchCerts } = certs();
    const env2 = { ...configured, ACCESS_TEAM_DOMAIN: "mattan-test.cloudflareaccess.com" };

    expect(await checkAccess(request(await token({ aud: AUD })), env2, { fetchCerts })).toBeNull();
  });

  const refused: [string, () => Promise<string | undefined>][] = [
    ["no token", async () => undefined],
    ["a token for another app", () => token({ aud: ["someone-elses-app"] })],
    ["a token from another team", () => token({ iss: "https://evil.cloudflareaccess.com" })],
    ["an expired token", () => token({ exp: Math.floor(Date.now() / 1000) - 120 })],
    ["a token that isn't valid yet", () => token({ nbf: Math.floor(Date.now() / 1000) + 600 })],
    ["a forged signature", () => token({}, { key: impostor.privateKey })],
    ["a token signed with an unknown key", () => token({}, { header: { alg: "RS256", kid: "key-9" } })],
    ["an unsigned token", async () => `${b64json({ alg: "none", kid: "key-1" })}.${b64json({ aud: [AUD], iss: TEAM })}.`],
    ["something that isn't a JWT", async () => "not.a.jwt"],
  ];
  for (const [what, make] of refused) {
    it(`refuses ${what} with 403`, async () => {
      const { fetchCerts } = certs();
      const res = await checkAccess(request(await make()), configured, { fetchCerts });

      expect(res?.status).toBe(403);
      expect(await res?.json()).toEqual({ error: "Forbidden" });
    });
  }

  it("skips the check on localhost (local dev and tests)", async () => {
    const { fetchCerts, calls } = certs();

    expect(await checkAccess(request(undefined, "http://localhost:8787/api/items"), configured, { fetchCerts })).toBeNull();
    expect(await checkAccess(request(undefined, "http://127.0.0.1:8787/api/items"), env, { fetchCerts })).toBeNull();
    expect(calls).toEqual([]);
  });

  it("fails closed with 503 anywhere else when Access isn't configured", async () => {
    const res = await checkAccess(request(await token()), env, certs());

    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ error: "Access isn't configured" });
  });

  it("refetches the certs once when a token names a new key (rotation)", async () => {
    const rotated = await keyPair("key-2");
    let served = [signing.jwk];
    const calls: string[] = [];
    const fetchCerts = async (url: string) => {
      calls.push(url);
      return Response.json({ keys: served });
    };
    const team = { ...configured, ACCESS_TEAM_DOMAIN: "https://rotation-test.cloudflareaccess.com" };
    const iss = "https://rotation-test.cloudflareaccess.com";
    let clock = Date.now();
    const now = () => clock;

    expect(await checkAccess(request(await token({ iss })), team, { fetchCerts, now })).toBeNull();
    served = [signing.jwk, rotated.jwk];
    const newKeyToken = await token({ iss }, { key: rotated.privateKey, header: { alg: "RS256", kid: "key-2" } });

    // Unknown keys trigger at most one refetch a minute, so junk tokens can't make it fetch endlessly.
    expect((await checkAccess(request(newKeyToken), team, { fetchCerts, now }))?.status).toBe(403);
    expect(calls.length).toBe(1);
    clock += 61_000;
    expect(await checkAccess(request(newKeyToken), team, { fetchCerts, now })).toBeNull();
    expect(calls.length).toBe(2);
  });
});

describe("the Worker with Access configured", () => {
  it("refuses the item API without a token", async () => {
    const res = await worker.fetch(request(), configured);
    expect(res.status).toBe(403);
  });

  it("fails closed when deployed without the Access settings", async () => {
    const res = await worker.fetch(request(), env);
    expect(res.status).toBe(503);
  });

  it("serves the item API with a valid token", async () => {
    // The certs come from the fake above: checkAccess caches them per team, and
    // the Worker's own fetch would otherwise go to Cloudflare.
    await checkAccess(request(await token()), configured, certs());

    const res = await worker.fetch(request(await token()), configured);
    expect(res.status).toBe(200);
  });

  it("leaves the printer routes to their bearer token", async () => {
    const res = await worker.fetch(
      new Request(`${SITE}/api/printer/items`, { headers: { Authorization: "Bearer test-printer-token" } }) as Incoming,
      configured,
    );
    expect(res.status).toBe(200);
  });
});
