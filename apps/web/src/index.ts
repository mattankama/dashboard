import { error } from "./http";
import { createItem, getItems, patchItem, removeItem } from "./items";

type Handler = (request: Request, env: Env, params: Record<string, string | undefined>) => Promise<Response>;

interface Route {
  pattern: URLPattern;
  methods: Record<string, Handler>;
}

const routes: Route[] = [
  { pattern: new URLPattern({ pathname: "/api/items" }), methods: { GET: getItems, POST: createItem } },
  { pattern: new URLPattern({ pathname: "/api/items/:id" }), methods: { PATCH: patchItem, DELETE: removeItem } },
];

async function handleApi(request: Request, env: Env): Promise<Response> {
  for (const route of routes) {
    const match = route.pattern.exec(request.url);
    if (!match) continue;

    const handler = route.methods[request.method];
    if (!handler) return error(405, "Method not allowed", { Allow: Object.keys(route.methods).join(", ") });
    return handler(request, env, match.pathname.groups);
  }
  return error(404, "Not found");
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env);
      } catch (err) {
        console.error("Unhandled error", request.method, pathname, err);
        return error(500, "Internal error");
      }
    }

    // In production only /api/* reaches the Worker (run_worker_first); this
    // fallback covers tests and any request that arrives here anyway.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
