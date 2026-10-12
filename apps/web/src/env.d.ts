declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    /** Bearer token for /api/printer/*. Unset means those routes refuse every request. */
    PRINTER_TOKEN?: string;
    /** Cloudflare Access team domain, e.g. https://<team>.cloudflareaccess.com (not secret). */
    ACCESS_TEAM_DOMAIN?: string;
    /** The Access application's AUD tag (not secret). */
    ACCESS_AUD?: string;
  }
}
interface Env extends Cloudflare.Env {}
