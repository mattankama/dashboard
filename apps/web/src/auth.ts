// Signing in (docs/DECISIONS.md, 2026-10-12): one password, LOGIN_PASSWORD, gets a
// session cookie that lasts a year. The cookie holds only its expiry and an
// HMAC-SHA256, under SESSION_SECRET, of that expiry and the password. Nothing is
// stored, and changing either secret signs every device out.
import { error, readJson } from "./http";
import { validateLogin } from "./validate";

/** __Host-: browsers keep it only from HTTPS, for this exact host, at Path=/. */
export const COOKIE = "__Host-dashboard_session";
const YEAR_S = 365 * 24 * 60 * 60;
// Settings shorter than these count as not set up, so a weak deploy fails closed.
const PASSWORD_MIN = 16;
const SECRET_MIN = 32;
/** <expiry in Unix seconds>.<HMAC in base64url> */
const SESSION = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/;

export interface Login {
  password: string;
  secret: string;
}

const encoder = new TextEncoder();

/** The login settings, or null when either is missing or too short. */
function loginSettings(env: Env): Login | null {
  const password = env.LOGIN_PASSWORD ?? "";
  const secret = env.SESSION_SECRET ?? "";
  return password.length >= PASSWORD_MIN && secret.length >= SECRET_MIN ? { password, secret } : null;
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// The password is part of what's signed, so a new password ends every session.
const signed = (expires: number, password: string) => encoder.encode(`session.v1|${expires}|${password}`);

function toBase64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array {
  return Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

/** A session cookie's value, good for a year from `now` (milliseconds). */
export async function createSession(login: Login, now: number): Promise<string> {
  const expires = Math.floor(now / 1000) + YEAR_S;
  const mac = await crypto.subtle.sign("HMAC", await hmacKey(login.secret), signed(expires, login.password));
  return `${expires}.${toBase64url(mac)}`;
}

async function isValidSession(value: string, login: Login, now: number): Promise<boolean> {
  const match = SESSION.exec(value);
  if (!match) return false;
  const expires = Number(match[1]);
  if (expires * 1000 <= now) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(login.secret), fromBase64url(match[2]), signed(expires, login.password));
}

function cookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

/**
 * Compares SHA-256 digests in constant time, so neither the secret's contents
 * nor its length leak through timing.
 */
export async function sameSecret(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(given)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/**
 * Null when the request may go on; otherwise the response to send. Local dev
 * (localhost) runs open until a login is set in .dev.vars. Anywhere else, a
 * missing or weak login means 503: the app never runs open.
 */
export async function checkSession(request: Request, env: Env): Promise<Response | null> {
  const login = loginSettings(env);
  if (!login) {
    const { hostname } = new URL(request.url);
    const local = hostname === "localhost" || hostname === "127.0.0.1";
    if (local && !env.LOGIN_PASSWORD && !env.SESSION_SECRET) return null;
    return error(503, "Login isn't set up");
  }

  const session = cookie(request, COOKIE);
  if (session !== null && (await isValidSession(session, login, Date.now()))) return null;
  return error(401, "Sign in");
}

/** POST /api/login {password}: the right password gets the session cookie. */
export async function signIn(request: Request, env: Env): Promise<Response> {
  const login = loginSettings(env);
  if (!login) return error(503, "Login isn't set up");

  const body = await readJson(request);
  if (!body.ok) return error(body.status, body.message);
  const password = validateLogin(body.value);
  if (!password.ok) return error(400, password.message);

  if (!(await sameSecret(password.value, login.password))) {
    console.warn("Sign-in refused: wrong password");
    return error(401, "Wrong password");
  }
  const session = await createSession(login, Date.now());
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": `${COOKIE}=${session}; Path=/; Max-Age=${YEAR_S}; HttpOnly; Secure; SameSite=Strict` },
  });
}
