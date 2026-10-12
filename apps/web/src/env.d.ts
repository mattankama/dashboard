declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    /** Bearer token for /api/printer/*. Unset means those routes refuse every request. */
    PRINTER_TOKEN?: string;
  }
}
interface Env extends Cloudflare.Env {}
