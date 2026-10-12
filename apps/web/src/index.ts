import { error } from "./http";

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/api/")) {
      return error(404, "Not found");
    }

    // In production only /api/* reaches the Worker (run_worker_first); this
    // fallback covers tests and any request that arrives here anyway.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
