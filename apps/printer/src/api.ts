// The Dashboard web app's printer routes (spec/SPEC-web.md, "Printer routes").

export interface Item {
  id: string;
  text: string;
  category: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type RunStatus = "printed" | "emailed_only" | "failed";

export interface RunReport {
  week: string;
  status: RunStatus;
  printedAt: string | null;
  emailedAt: string | null;
}

export interface DashboardApi {
  activeItems(): Promise<Item[]>;
  recordRun(run: RunReport): Promise<void>;
}

function isItem(value: unknown): value is Item {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.text === "string" &&
    typeof item.pinned === "boolean" &&
    (item.category === null || typeof item.category === "string")
  );
}

/** Messages name the request and the HTTP status, never the token. */
async function describeFailure(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  const reason = typeof body?.error === "string" ? body.error : res.statusText;
  return `HTTP ${res.status}${reason ? ` (${reason})` : ""}`;
}

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === "TimeoutError") return "timed out";
  return err instanceof Error ? err.message : String(err);
}

export function dashboardApi(
  baseUrl: string,
  token: string,
  {
    fetch = globalThis.fetch,
    timeoutMs = 30_000,
    accessServiceToken = null,
  }: { fetch?: typeof globalThis.fetch; timeoutMs?: number; accessServiceToken?: { id: string; secret: string } | null } = {},
): DashboardApi {
  // Behind Cloudflare Access, a service token gets the job through to the Worker,
  // which then still checks the printer's own bearer token.
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (accessServiceToken) {
    headers["CF-Access-Client-Id"] = accessServiceToken.id;
    headers["CF-Access-Client-Secret"] = accessServiceToken.secret;
  }

  return {
    async activeItems() {
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/api/printer/items`, { headers, signal: AbortSignal.timeout(timeoutMs) });
      } catch (err) {
        throw new Error(`items request failed: ${describeError(err)}`);
      }
      if (!res.ok) throw new Error(`items request failed: ${await describeFailure(res)}`);

      const body = (await res.json().catch(() => null)) as { items?: unknown } | null;
      if (!Array.isArray(body?.items) || !body.items.every(isItem)) throw new Error("items request failed: unexpected response");
      return body.items;
    },

    async recordRun(run) {
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/api/printer/runs`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(run),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new Error(`run request failed: ${describeError(err)}`);
      }
      if (!res.ok) throw new Error(`run request failed: ${await describeFailure(res)}`);
    },
  };
}
