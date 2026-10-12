// Defense in depth behind Cloudflare Access (spec: Phase 4). Access adds a signed
// JWT to each request it lets through; the Worker checks it before any /api/* route
// except the printer's, which use their own bearer token.
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
import { error } from "./http";

const CERTS_TTL_MS = 60 * 60 * 1000; // refresh the team's keys hourly
const REFETCH_GAP_MS = 60 * 1000; // an unknown key refetches at most once a minute
const SKEW_S = 60; // clock difference allowed on exp/nbf

interface CertCache {
  keys: Map<string, CryptoKey>;
  fetchedAt: number;
}

// Per isolate, per team: the keys from https://<team>.cloudflareaccess.com/cdn-cgi/access/certs.
const caches = new Map<string, CertCache>();

export interface AccessOptions {
  fetchCerts?: (url: string) => Promise<Response>;
  now?: () => number;
}

function teamUrl(domain: string): string {
  const trimmed = domain.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function base64url(part: string): Uint8Array {
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function loadKeys(team: string, fetchCerts: (url: string) => Promise<Response>, now: number): Promise<CertCache> {
  const res = await fetchCerts(`${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs request failed: HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid || jwk.kty !== "RSA") continue;
    keys.set(jwk.kid, await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
  }
  const cache = { keys, fetchedAt: now };
  caches.set(team, cache);
  return cache;
}

async function keyFor(team: string, kid: string, fetchCerts: (url: string) => Promise<Response>, now: number) {
  let cache = caches.get(team);
  if (!cache || now - cache.fetchedAt > CERTS_TTL_MS) cache = await loadKeys(team, fetchCerts, now);
  else if (!cache.keys.has(kid) && now - cache.fetchedAt > REFETCH_GAP_MS) cache = await loadKeys(team, fetchCerts, now);
  return cache.keys.get(kid);
}

/** RS256 signature by one of the team's keys, issuer = the team, audience = this app, not expired. */
async function isValid(token: string, team: string, audience: string, fetchCerts: (url: string) => Promise<Response>, now: number) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  let header: { alg?: unknown; kid?: unknown };
  let claims: { iss?: unknown; aud?: unknown; exp?: unknown; nbf?: unknown };
  try {
    header = JSON.parse(new TextDecoder().decode(base64url(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(base64url(parts[1])));
  } catch {
    return false;
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return false;

  const key = await keyFor(team, header.kid, fetchCerts, now);
  if (!key) return false;
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64url(parts[2]), signed))) return false;

  const seconds = now / 1000;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  return (
    claims.iss === team &&
    audiences.includes(audience) &&
    typeof claims.exp === "number" &&
    claims.exp + SKEW_S > seconds &&
    (claims.nbf === undefined || (typeof claims.nbf === "number" && claims.nbf - SKEW_S <= seconds))
  );
}

/**
 * Null when the request may go on; otherwise the response to send. Local dev
 * (localhost) has no Access in front, so it's skipped there. Anywhere else, missing
 * settings mean 503: the API never runs open.
 */
export async function checkAccess(
  request: Request,
  env: Env,
  { fetchCerts = (url) => fetch(url), now = () => Date.now() }: AccessOptions = {},
): Promise<Response | null> {
  const { hostname } = new URL(request.url);
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return error(503, "Access isn't configured");

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return error(403, "Forbidden");
  try {
    if (await isValid(token, teamUrl(env.ACCESS_TEAM_DOMAIN), env.ACCESS_AUD, fetchCerts, now())) return null;
  } catch (err) {
    console.error("Access check failed", err); // e.g. the certs couldn't be fetched: fail closed
  }
  return error(403, "Forbidden");
}
