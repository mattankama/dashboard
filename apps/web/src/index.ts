import { checkSession, signIn } from "./auth";
import { error } from "./http";
import { createItem, getItems, patchItem, removeItem } from "./items";
import { checkPrinterToken, createRun, getPrinterItems } from "./printer";

type Handler = (request: Request, env: Env, params: Record<string, string | undefined>) => Promise<Response>;

interface Route {
  pattern: URLPattern;
  methods: Record<string, Handler>;
}

const routes: Route[] = [
  { pattern: new URLPattern({ pathname: "/api/login" }), methods: { POST: signIn } },
  { pattern: new URLPattern({ pathname: "/api/items" }), methods: { GET: getItems, POST: createItem } },
  { pattern: new URLPattern({ pathname: "/api/items/:id" }), methods: { PATCH: patchItem, DELETE: removeItem } },
  { pattern: new URLPattern({ pathname: "/api/printer/items" }), methods: { GET: getPrinterItems } },
  { pattern: new URLPattern({ pathname: "/api/printer/runs" }), methods: { POST: createRun } },
];

// Checked before routing: the printer routes need the printer's bearer token,
// signing in needs nothing, and every other route needs a signed-in session.
function checkCaller(request: Request, env: Env): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/api/printer/")) return checkPrinterToken(request, env);
  if (pathname === "/api/login") return Promise.resolve(null);
  return checkSession(request, env);
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const refused = await checkCaller(request, env);
  if (refused) return refused;

  for (const route of routes) {
    const match = route.pattern.exec(request.url);
    if (!match) continue;

    const handler = route.methods[request.method];
    if (!handler) return error(405, "Method not allowed", { Allow: Object.keys(route.methods).join(", ") });
    return handler(request, env, match.pathname.groups);
  }
  return error(404, "Not found");
}

// API replies hold private data and are JSON or empty: never cached, never sniffed.
function withApiHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "no-store");
  out.headers.set("X-Content-Type-Options", "nosniff");
  return out;
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/api/")) {
      let res: Response;
      try {
        res = await handleApi(request, env);
      } catch (err) {
        console.error("Unhandled error", request.method, pathname, err);
        res = error(500, "Internal error");
      }
      return withApiHeaders(res);
    }

    // In production only /api/* reaches the Worker (run_worker_first); this
    // fallback covers tests and any request that arrives here anyway.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
