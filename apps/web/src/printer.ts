import { sameSecret } from "./auth";
import { insertRun, listItems } from "./db";
import { error, json, readJson } from "./http";
import { validateRun } from "./validate";

/**
 * Checks the printer's bearer token. Returns an error response to send, or
 * null when the request may go ahead. A missing PRINTER_TOKEN refuses
 * everything (503); it never means "open".
 */
export async function checkPrinterToken(request: Request, env: Env): Promise<Response | null> {
  if (!env.PRINTER_TOKEN) return error(503, "Printer access isn't configured");

  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match || !(await sameSecret(match[1], env.PRINTER_TOKEN))) return error(401, "Unauthorized");
  return null;
}

export async function getPrinterItems(_request: Request, env: Env): Promise<Response> {
  return json({ items: await listItems(env.DB, "active") });
}

export async function createRun(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return error(body.status, body.message);

  const input = validateRun(body.value);
  if (!input.ok) return error(400, input.message);

  return json({ run: await insertRun(env.DB, input.value) }, 201);
}
