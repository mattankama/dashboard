declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    /** Bearer token for /api/printer/*. Unset means those routes refuse every request. */
    PRINTER_TOKEN?: string;
    /** The password for signing in (secret, at least 16 characters). Unset means the deployed app refuses everything. */
    LOGIN_PASSWORD?: string;
    /** Signs session cookies (secret, at least 32 characters). Changing it signs every device out. */
    SESSION_SECRET?: string;
  }
}
interface Env extends Cloudflare.Env {}
